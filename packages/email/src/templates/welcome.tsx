import {
  Body,
  Button,
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

interface WelcomeEmailProps {
  name: string;
}

const main = { backgroundColor: '#f9fafb', fontFamily: 'Inter, sans-serif' };
const container = { maxWidth: '600px', margin: '0 auto', padding: '40px 20px' };
const heading = { color: '#2563eb', fontSize: '24px', fontWeight: 700 };
const text = { color: '#374151', fontSize: '16px', lineHeight: '24px' };
const button = {
  backgroundColor: '#2563eb',
  borderRadius: '8px',
  color: '#fff',
  display: 'block',
  fontSize: '16px',
  fontWeight: 600,
  padding: '12px 24px',
  textDecoration: 'none',
  textAlign: 'center' as const,
};
const footer = { color: '#9ca3af', fontSize: '12px', textAlign: 'center' as const };

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Poolr — your savings circle is ready</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Welcome to Poolr! 🎉</Heading>
          <Text style={text}>Hi {name},</Text>
          <Text style={text}>
            Your account is now active and verified. You can start creating or joining savings
            groups (ajo/esusu) and saving together with people you trust.
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button href="https://poolr.app/groups" style={button}>
              Explore Groups
            </Button>
          </Section>
          <Hr />
          <Text style={footer}>© {new Date().getFullYear()} Poolr. All rights reserved.</Text>
        </Container>
      </Body>
    </Html>
  );
}
