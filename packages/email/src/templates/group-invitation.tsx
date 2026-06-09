import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface GroupInvitationEmailProps {
  recipientName: string;
  adminName: string;
  groupName: string;
  inviteToken: string;
}

const main = { backgroundColor: '#f9fafb', fontFamily: 'Inter, sans-serif' };
const container = { maxWidth: '600px', margin: '0 auto', padding: '40px 20px' };
const heading = { color: '#2563eb', fontSize: '24px', fontWeight: 700 };
const text = { color: '#374151', fontSize: '16px', lineHeight: '24px' };
const code = {
  backgroundColor: '#e5e7eb',
  borderRadius: '4px',
  color: '#111827',
  fontFamily: 'monospace',
  fontSize: '14px',
  padding: '12px 16px',
  display: 'block',
  margin: '16px 0',
};
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

export function GroupInvitationEmail({
  recipientName,
  adminName,
  groupName,
  inviteToken,
}: GroupInvitationEmailProps) {
  const joinUrl = `https://poolr.app/groups/join?token=${inviteToken}`;

  return (
    <Html>
      <Head />
      <Preview>{adminName} invited you to join "{groupName}" on Poolr</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>You're invited! 🎊</Heading>
          <Text style={text}>Hi {recipientName},</Text>
          <Text style={text}>
            <strong>{adminName}</strong> has invited you to join the savings group{' '}
            <strong>"{groupName}"</strong> on Poolr.
          </Text>
          <Text style={text}>Use the button below or enter the invite code manually:</Text>
          <Text style={code}>{inviteToken}</Text>
          <Button href={joinUrl} style={button}>
            Join Group
          </Button>
          <Text style={{ ...text, fontSize: '14px', color: '#6b7280', marginTop: '16px' }}>
            This invitation expires in 7 days.
          </Text>
          <Hr />
          <Text style={footer}>© {new Date().getFullYear()} Poolr. All rights reserved.</Text>
        </Container>
      </Body>
    </Html>
  );
}
