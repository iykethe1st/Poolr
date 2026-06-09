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

interface PayoutReceivedEmailProps {
  name: string;
  amountNgn: number;
  groupName: string;
}

const main = { backgroundColor: '#f9fafb', fontFamily: 'Inter, sans-serif' };
const container = { maxWidth: '600px', margin: '0 auto', padding: '40px 20px' };
const heading = { color: '#16a34a', fontSize: '24px', fontWeight: 700 };
const text = { color: '#374151', fontSize: '16px', lineHeight: '24px' };
const amountBox = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  padding: '20px',
  textAlign: 'center' as const,
  margin: '24px 0',
};
const amountText = { color: '#16a34a', fontSize: '36px', fontWeight: 700, margin: 0 };
const footer = { color: '#9ca3af', fontSize: '12px', textAlign: 'center' as const };

export function PayoutReceivedEmail({ name, amountNgn, groupName }: PayoutReceivedEmailProps) {
  const formatted = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amountNgn);

  return (
    <Html>
      <Head />
      <Preview>Your payout of {formatted} from "{groupName}" is on its way!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Payout Initiated 💰</Heading>
          <Text style={text}>Hi {name},</Text>
          <Text style={text}>
            Great news! Your payout from the group <strong>"{groupName}"</strong> has been initiated
            and is on its way to your account.
          </Text>
          <div style={amountBox}>
            <Text style={amountText}>{formatted}</Text>
            <Text style={{ ...text, margin: '4px 0 0', fontSize: '14px', color: '#166534' }}>
              Transfer in progress
            </Text>
          </div>
          <Text style={{ ...text, fontSize: '14px', color: '#6b7280' }}>
            Bank transfers typically complete within 1–3 business days depending on your bank.
          </Text>
          <Hr />
          <Text style={footer}>© {new Date().getFullYear()} Poolr. All rights reserved.</Text>
        </Container>
      </Body>
    </Html>
  );
}
