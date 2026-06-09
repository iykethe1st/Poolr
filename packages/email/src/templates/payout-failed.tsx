import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface PayoutFailedEmailProps {
  adminName: string;
  groupName: string;
  cycleNumber: number;
  error: string;
}

const main = { backgroundColor: '#f9fafb', fontFamily: 'Inter, sans-serif' };
const container = { maxWidth: '600px', margin: '0 auto', padding: '40px 20px' };
const heading = { color: '#dc2626', fontSize: '24px', fontWeight: 700 };
const text = { color: '#374151', fontSize: '16px', lineHeight: '24px' };
const errorBox = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
};
const errorText = { color: '#991b1b', fontSize: '14px', fontFamily: 'monospace', margin: 0 };
const footer = { color: '#9ca3af', fontSize: '12px', textAlign: 'center' as const };

export function PayoutFailedEmail({ adminName, groupName, cycleNumber, error }: PayoutFailedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Action required: Payout failed for &quot;{groupName}&quot; cycle {String(cycleNumber)}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>⚠️ Payout Failed — Action Required</Heading>
          <Text style={text}>Hi {adminName},</Text>
          <Text style={text}>
            The automated payout for <strong>cycle {cycleNumber}</strong> in the group{' '}
            <strong>"{groupName}"</strong> has failed after multiple retry attempts and requires
            your immediate attention.
          </Text>
          <div style={errorBox}>
            <Text style={errorText}>{error}</Text>
          </div>
          <Text style={text}>
            Please log in to the Poolr dashboard and manually initiate the transfer, or contact
            support if you need assistance.
          </Text>
          <Hr />
          <Text style={footer}>© {new Date().getFullYear()} Poolr. All rights reserved.</Text>
        </Container>
      </Body>
    </Html>
  );
}
