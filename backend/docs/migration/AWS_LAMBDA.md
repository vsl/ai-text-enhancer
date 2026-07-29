# AWS Lambda Migration Guide

This guide shows how to migrate the AI Text Enhancer Backend from Supabase Edge Functions to AWS Lambda with API Gateway.

**Estimated Time:** 4-8 hours

---

## Overview

### What Changes

- **Handler:** New `lambda/index.ts` (~80 lines)
- **Deployment:** AWS SAM or Serverless Framework
- **Environment:** AWS Systems Manager Parameter Store or Secrets Manager
- **Core Logic:** **NO CHANGES** ✅

### What Stays the Same

- All of `src/` directory (business logic)
- All tests
- Configuration files
- API contract

---

## Prerequisites

- AWS CLI installed and configured
- AWS account with appropriate permissions
- Node.js 22 installed
- Project tests passing locally

---

## Step-by-Step Migration

### 1. Install AWS SAM CLI

```bash
# macOS
brew tap aws/tap
brew install aws-sam-cli

# Verify installation
sam --version
```

### 2. Create Lambda Handler

Create `lambda/index.ts`:

```typescript
/**
 * AWS Lambda Handler for AI Text Enhancer Backend
 * 
 * Platform-specific adapter that:
 * 1. Parses API Gateway event
 * 2. Calls platform-agnostic core logic
 * 3. Returns API Gateway response
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { loadConfig, validateConfig } from '../src/config/index.js';
import { BatchOrchestrator } from '../src/services/batch-orchestrator.js';
import { AuthMiddleware } from '../src/services/auth-middleware.js';
import { QuotaService } from '../src/services/quota-service.js';
import { AuthorizationService } from '../src/services/authorization-service.js';
import { 
  AuthenticationError, 
  AuthorizationError 
} from '../src/errors/auth-errors.js';
import { QuotaError } from '../src/errors/quota-errors.js';
import { LLMError } from '../src/errors/llm-errors.js';
import { OrchestrationError } from '../src/errors/orchestration-errors.js';

// Initialize services (cold start optimization)
let orchestrator: BatchOrchestrator;
let authMiddleware: AuthMiddleware;

function initServices() {
  if (!orchestrator) {
    const config = loadConfig();
    validateConfig(config);
    
    const quotaService = new QuotaService(config.userService);
    const authzService = new AuthorizationService();
    
    orchestrator = new BatchOrchestrator(
      config.llmProviders,
      quotaService,
      authzService,
      config.timeout
    );
    
    authMiddleware = new AuthMiddleware(config);
  }
}

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: '',
      };
    }

    // Initialize services
    initServices();

    // Route: GET /health
    if (event.httpMethod === 'GET' && event.path.endsWith('/health')) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ 
          status: 'ok', 
          service: 'ai-text-enhancer',
          requestId: context.requestId 
        }),
      };
    }

    // Route: POST /
    if (event.httpMethod === 'POST') {
      // Parse request body
      if (!event.body) {
        return errorResponse(400, 'MISSING_BODY', 'Request body is required', corsHeaders);
      }

      const body = JSON.parse(event.body);

      // Authenticate
      const user = await authMiddleware.authenticate(event.headers || {});

      // Process batch
      const result = await orchestrator.processBatch(user, body);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify(result),
      };
    }

    // 404 Not Found
    return errorResponse(404, 'NOT_FOUND', 'Endpoint not found', corsHeaders);

  } catch (error) {
    return handleError(error, corsHeaders);
  }
}

function handleError(error: unknown, corsHeaders: Record<string, string>): APIGatewayProxyResult {
  console.error('[ERROR]', error);

  if (error instanceof AuthenticationError) {
    return errorResponse(401, 'AUTHENTICATION_FAILED', error.message, corsHeaders);
  }

  if (error instanceof AuthorizationError) {
    return errorResponse(403, 'AUTHORIZATION_FAILED', error.message, corsHeaders);
  }

  if (error instanceof QuotaError) {
    return errorResponse(429, 'QUOTA_EXCEEDED', error.message, corsHeaders);
  }

  if (error instanceof LLMError) {
    return errorResponse(502, 'LLM_ERROR', error.message, corsHeaders);
  }

  if (error instanceof OrchestrationError) {
    const status = error.code.includes('EXCEEDED') || error.code.includes('EMPTY') ? 400 : 500;
    return errorResponse(status, error.code, error.message, corsHeaders);
  }

  if (error instanceof SyntaxError) {
    return errorResponse(400, 'INVALID_JSON', 'Request body is not valid JSON', corsHeaders);
  }

  return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred', corsHeaders);
}

function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  headers: Record<string, string>
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ error: { code, message } }),
  };
}
```

**Key differences from Supabase:**
- Uses API Gateway event format instead of `Request`
- Returns `APIGatewayProxyResult` instead of `Response`
- Cold start optimization with service initialization
- Request ID from Lambda context

---

### 3. Create SAM Template

Create `template.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: AI Text Enhancer Backend

Globals:
  Function:
    Timeout: 30
    MemorySize: 512
    Runtime: nodejs18.x
    Architectures:
      - arm64

Resources:
  EnhanceFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./
      Handler: lambda/index.handler
      Events:
        Health:
          Type: Api
          Properties:
            Path: /health
            Method: GET
        Enhance:
          Type: Api
          Properties:
            Path: /
            Method: POST
        Options:
          Type: Api
          Properties:
            Path: /{proxy+}
            Method: OPTIONS
      Environment:
        Variables:
          NODE_ENV: production
          GEMINI_API_KEY: !Sub '{{resolve:secretsmanager:enhance/gemini:SecretString:apiKey}}'
          OPENROUTER_API_KEY: !Sub '{{resolve:secretsmanager:enhance/openrouter:SecretString:apiKey}}'
          USER_SERVICE_URL: !Sub '{{resolve:secretsmanager:enhance/user-service:SecretString:url}}'
          USER_SERVICE_API_KEY: !Sub '{{resolve:secretsmanager:enhance/user-service:SecretString:apiKey}}'
          LLM_TIMEOUT_MS: '30000'
          MAX_BATCH_SIZE: '10'

Outputs:
  ApiUrl:
    Description: "API Gateway endpoint URL"
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/"
  FunctionArn:
    Description: "Lambda Function ARN"
    Value: !GetAtt EnhanceFunction.Arn
```

---

### 4. Create Build Configuration

Create `tsconfig.lambda.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./",
    "module": "commonjs",
    "target": "ES2020"
  },
  "include": [
    "lambda/**/*",
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "tests",
    "supabase"
  ]
}
```

Update `package.json`:

```json
{
  "scripts": {
    "build:lambda": "tsc -p tsconfig.lambda.json",
    "deploy:lambda": "sam deploy --guided"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.130"
  }
}
```

---

### 5. Set Up Secrets in AWS

```bash
# Create secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name enhance/gemini \
  --secret-string '{"apiKey":"YOUR_GEMINI_KEY"}'

aws secretsmanager create-secret \
  --name enhance/openrouter \
  --secret-string '{"apiKey":"YOUR_OPENROUTER_KEY"}'

aws secretsmanager create-secret \
  --name enhance/user-service \
  --secret-string '{"url":"https://...","apiKey":"YOUR_KEY"}'
```

---

### 6. Deploy to AWS

```bash
# Build TypeScript
npm install
npm run build:lambda

# Deploy with SAM
sam build
sam deploy --guided

# Follow prompts:
# - Stack Name: ai-text-enhancer
# - AWS Region: us-east-1 (or your preferred region)
# - Confirm changes: Y
# - Allow SAM CLI IAM role creation: Y
# - Save arguments to config: Y
```

---

### 7. Test Deployment

```bash
# Get API URL from output
API_URL=$(aws cloudformation describe-stacks \
  --stack-name ai-text-enhancer \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

# Test health endpoint
curl "$API_URL/health"

# Test enhancement
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"assistants":[...]}'
```

---

## Environment Variables

| Variable | Source | Notes |
|----------|--------|-------|
| `GEMINI_API_KEY` | Secrets Manager | `enhance/gemini` |
| `OPENROUTER_API_KEY` | Secrets Manager | `enhance/openrouter` |
| `USER_SERVICE_URL` | Secrets Manager | `enhance/user-service` |
| `USER_SERVICE_API_KEY` | Secrets Manager | `enhance/user-service` |
| `LLM_TIMEOUT_MS` | Environment Variable | Default: 30000 |
| `MAX_BATCH_SIZE` | Environment Variable | Default: 10 |

---

## Monitoring

### View Logs

```bash
# Get function name
FUNCTION_NAME=$(aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `enhance`)].FunctionName' \
  --output text)

# View recent logs
sam logs -n $FUNCTION_NAME --tail
```

### CloudWatch Dashboard

Create dashboard in AWS Console:
- Lambda invocations
- Error rate
- Duration
- Throttles

---

## Cost Estimate

| Resource | Free Tier | Beyond Free Tier |
|----------|-----------|-----------------|
| Lambda | 1M requests/month | $0.20 per 1M requests |
| API Gateway | 1M requests/month (12 months) | $3.50 per 1M requests |
| Secrets Manager | 30 days free | $0.40 per secret/month |

**Example:** 10M requests/month = ~$35/month

---

## Rollback

```bash
# List deployments
aws cloudformation describe-stacks --stack-name ai-text-enhancer

# Rollback to previous version
aws cloudformation update-stack \
  --stack-name ai-text-enhancer \
  --use-previous-template
```

---

## Cleanup

```bash
# Delete stack
sam delete --stack-name ai-text-enhancer

# Delete secrets
aws secretsmanager delete-secret --secret-id enhance/gemini
aws secretsmanager delete-secret --secret-id enhance/openrouter
aws secretsmanager delete-secret --secret-id enhance/user-service
```

---

## Troubleshooting

### Cold Starts Too Slow

- Increase memory (more CPU allocated)
- Use Provisioned Concurrency
- Consider Lambda SnapStart (Java only currently)

### Timeout Errors

- Increase Lambda timeout in `template.yaml`
- Check LLM provider response times
- Monitor CloudWatch logs

### Permission Errors

- Verify IAM role has Secrets Manager access
- Check CloudFormation stack events
- Review Lambda execution role

---

## Next Steps

1. **Set up CI/CD:** GitHub Actions with SAM deploy
2. **Add monitoring:** CloudWatch alarms for errors/latency
3. **Load testing:** Ensure performance under load
4. **Documentation:** Update team docs with AWS-specific info

---

**Migration complete!** Your backend now runs on AWS Lambda. 🎉
