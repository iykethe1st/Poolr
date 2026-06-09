import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface KycResultEmailProps {
  name: string;
  approved: boolean;
}

const main = { backgroundColor: '#f9fafb', fontFamily: 'Inter, sans-serif' };
const container = { maxWidth: '600px', margin: '0 auto', padding: '40px 20px' };
const footer = { color: '#9ca3af', fontSize: '12px', textAlign: 'center' as const };

export function KycResultEmail({ name, approved }: KycResultEmailProps) {
  const headingColor = approved ? '#16a34a' : '#dc2626';
  const heading = { color: headingColor, fontSize: '24px', fontWeight: 700 };
  const text = { color: '#374151', fontSize: '16px', lineHeight: '24px' };

  return (
    <Html>
      <Head />
      <Preview>
        {approved ? 'KYC Verification Approved' : 'KYC Verification Rejected'}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>
            {approved ? 'Identity Verified ✅' : 'Verification Failed ❌'}
          </Heading>
          <Text style={text}>Hi {name},</Text>
          {approved ? (
            <Section>
              <Text style={text}>
                Your identity has been successfully verified. You can now join and participate in
                Poolr savings groups.
              </Text>
            </Section>
          ) : (
            <Section>
              <Text style={text}>
                We were unable to verify your identity. Please double-check your details and try
                again. If you continue to experience issues, contact our support team.
              </Text>
            </Section>
          )}
          <Hr />
          <Text style={footer}>© {new Date().getFullYear()} Poolr. All rights reserved.</Text>
        </Container>
      </Body>
    </Html>
  );
}
