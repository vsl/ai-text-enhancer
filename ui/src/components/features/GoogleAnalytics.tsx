import { SITE_CONFIG } from '@/config/site.config';
import Script from 'next/script';

export function GoogleAnalytics() {
  // Only load Google Analytics in production
  if (process.env.NODE_ENV !== 'production' || !SITE_CONFIG.analyticsMeasurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${SITE_CONFIG.analyticsMeasurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${SITE_CONFIG.analyticsMeasurementId}');
        `}
      </Script>
    </>
  );
}
