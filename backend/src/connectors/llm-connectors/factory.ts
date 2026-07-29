/**
 * LLM Connector Factory
 * 
 * Creates connector instances based on provider configuration.
 * Platform-agnostic factory pattern.
 */

import type { LLMConnector } from '../../types/llm.types.ts';
import type { LLMProviderConfig } from '../../types/config.types.ts';
import { GeminiConnector } from './gemini-connector.ts';
import { OpenRouterConnector } from './openrouter-connector.ts';
import { LMStudioConnector } from './lmstudio-connector.ts';

export class LLMConnectorFactory {
  /**
   * Create a single connector from provider configuration
   */
  static create(providerConfig: LLMProviderConfig): LLMConnector {
    switch (providerConfig.name) {
      case 'gemini':
        if (!providerConfig.apiKey) {
          throw new Error('Gemini API key is required');
        }
        return new GeminiConnector(providerConfig.apiKey);
      
      case 'openrouter':
        if (!providerConfig.apiKey) {
          throw new Error('OpenRouter API key is required');
        }
        return new OpenRouterConnector(providerConfig.apiKey);
      
      case 'lmstudio':
        return new LMStudioConnector(providerConfig.baseUrl || 'http://localhost:1234');
      
      default:
        throw new Error(`Unknown provider: ${providerConfig.name}`);
    }
  }

  /**
   * Create all connectors from provider configurations
   * Returns a map of provider name to connector instance
   */
  static createAll(providers: LLMProviderConfig[]): Map<string, LLMConnector> {
    const connectors = new Map<string, LLMConnector>();
    
    for (const provider of providers) {
      try {
        const connector = this.create(provider);
        connectors.set(provider.name, connector);
      } catch (error) {
        // Log error but continue with other providers
        console.error(`Failed to create connector for ${provider.name}:`, error);
      }
    }

    if (connectors.size === 0) {
      throw new Error('No LLM connectors could be initialized');
    }

    return connectors;
  }

  /**
   * Get connector by provider name from a map
   */
  static getConnector(
    connectors: Map<string, LLMConnector>, 
    providerName: string
  ): LLMConnector {
    const connector = connectors.get(providerName);
    
    if (!connector) {
      throw new Error(`No connector found for provider: ${providerName}`);
    }

    return connector;
  }
}
