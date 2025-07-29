# AWS SNS Setup for SES Bounces and Complaints

This document explains how to set up AWS SNS notifications to handle SES bounces and complaints for the cipher-notes application.

## Overview

The application now includes an SNS endpoint (`/sns`) that handles:
- SES bounce notifications
- SES complaint notifications
- SNS subscription confirmations

## Setup Instructions

### 1. Create SNS Topics

Create two SNS topics in your AWS account:

```bash
# Create bounce topic
aws sns create-topic --name ses-bounces

# Create complaint topic
aws sns create-topic --name ses-complaints
```

### 2. Configure SES to Send Notifications

Configure your SES configuration set to send bounces and complaints to the SNS topics:

```bash
# Create configuration set
aws ses create-configuration-set --configuration-set-name cipher-notes-config

# Add bounce notification
aws ses create-configuration-set-event-destination \
  --configuration-set-name cipher-notes-config \
  --event-destination-name bounce-destination \
  --event-destination '{
    "Enabled": true,
    "MatchingEventTypes": ["bounce"],
    "SNSDestination": {
      "TopicARN": "arn:aws:sns:REGION:ACCOUNT:ses-bounces"
    }
  }'

# Add complaint notification
aws ses create-configuration-set-event-destination \
  --configuration-set-name cipher-notes-config \
  --event-destination-name complaint-destination \
  --event-destination '{
    "Enabled": true,
    "MatchingEventTypes": ["complaint"],
    "SNSDestination": {
      "TopicARN": "arn:aws:sns:REGION:ACCOUNT:ses-complaints"
    }
  }'
```

### 3. Subscribe to SNS Topics

Subscribe your application endpoint to the SNS topics:

```bash
# Subscribe to bounce topic
aws sns subscribe \
  --topic-arn arn:aws:sns:REGION:ACCOUNT:ses-bounces \
  --protocol https \
  --notification-endpoint https://your-domain.com/sns

# Subscribe to complaint topic
aws sns subscribe \
  --topic-arn arn:aws:sns:REGION:ACCOUNT:ses-complaints \
  --protocol https \
  --notification-endpoint https://your-domain.com/sns
```

### 4. Update SES Configuration

When sending emails via SES, include the configuration set:

```javascript
const sesClient = new SESClient({ region: 'us-east-1' });
await sesClient.send(new SendEmailCommand({
  Source: 'noreply@yourdomain.com',
  Destination: { ToAddresses: ['user@example.com'] },
  Message: { /* ... */ },
  ConfigurationSetName: 'cipher-notes-config'
}));
```

## How It Works

### Bounce Handling
- When an email bounces, SES sends a notification to the SNS bounce topic
- The SNS endpoint receives the notification and processes it
- For permanent bounces, the user is marked as inactive (`is_active = false`)
- Temporary bounces are logged but don't affect user status

### Complaint Handling
- When a user files a complaint, SES sends a notification to the SNS complaint topic
- The SNS endpoint receives the notification and processes it
- The user is marked as inactive (`is_active = false`)

### Database Changes
- Added `is_active` boolean field to the `users` table (default: true)
- Added index on `is_active` for better query performance

## Security Considerations

1. **Signature Verification**: The endpoint includes basic SNS signature verification
2. **HTTPS Only**: SNS subscriptions should use HTTPS endpoints
3. **Access Control**: Consider adding additional authentication for the SNS endpoint
4. **Rate Limiting**: The endpoint is subject to the same rate limiting as other endpoints

## Monitoring

Monitor the following logs:
- SNS subscription confirmations
- Bounce notifications and user deactivations
- Complaint notifications and user deactivations
- Signature verification failures

## Testing

You can test the endpoint using the AWS SNS console or CLI:

```bash
# Test subscription confirmation
aws sns confirm-subscription \
  --topic-arn arn:aws:sns:REGION:ACCOUNT:ses-bounces \
  --token YOUR_SUBSCRIPTION_TOKEN

# Test notification (for development only)
aws sns publish \
  --topic-arn arn:aws:sns:REGION:ACCOUNT:ses-bounces \
  --message '{"notificationType":"Bounce","bounce":{"bounceType":"Permanent","bouncedRecipients":[{"emailAddress":"test@example.com"}]}}'
```

## Environment Variables

Ensure these environment variables are set:
- `AWS_ACCESS_KEY_ID`
- `AWS_ACCESS_KEY_SECRET`
- `AWS_REGION`

## Migration

Run the database migration to add the `is_active` field:

```bash
bun run db:migrate
```