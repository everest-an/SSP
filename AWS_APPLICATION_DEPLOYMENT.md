# AWS Application Deployment Guide

**Version**: 1.0  
**Date**: 2025-11-17

---

## Overview

This document provides comprehensive instructions for deploying the SSP (Smart Store Payment) application to AWS infrastructure.

---

## Architecture Overview

The SSP application will be deployed with the following AWS services:

-   **EC2**: Application servers running Node.js
-   **RDS MySQL**: Database (see `AWS_RDS_DEPLOYMENT.md`)
-   **S3**: Static assets and file uploads
-   **CloudFront**: CDN for static content
-   **ALB**: Application Load Balancer
-   **Route 53**: DNS management
-   **ACM**: SSL/TLS certificates
-   **Secrets Manager**: Secure credential storage
-   **CloudWatch**: Logging and monitoring

---

## Prerequisites

-   AWS Account with appropriate IAM permissions
-   AWS CLI installed and configured
-   Node.js 22.x and pnpm installed locally
-   Domain name registered (optional but recommended)
-   RDS MySQL instance deployed (see `AWS_RDS_DEPLOYMENT.md`)

---

## Step 1: Prepare the Application

### 1.1 Build the Application

```bash
# Clone the repository
git clone https://github.com/your-org/SSP.git
cd SSP

# Install dependencies
pnpm install

# Build the application
pnpm run build

# Verify build output
ls -la dist/
```

### 1.2 Create Environment Configuration

Create a production `.env` file:

```bash
# Database
DATABASE_URL=mysql://admin:PASSWORD@ssp-mysql-db.xxxxx.rds.amazonaws.com:3306/ssp_db

# Server
PORT=3000
NODE_ENV=production
HOST=0.0.0.0

# JWT
JWT_SECRET=your-production-jwt-secret-min-32-chars

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_BUCKET=ssp-uploads-prod

# Face Recognition
FACE_RECOGNITION_THRESHOLD=0.6

# CORS
CORS_ORIGIN=https://yourdomain.com
```

---

## Step 2: Create S3 Bucket for Uploads

```bash
# Create S3 bucket
aws s3 mb s3://ssp-uploads-prod --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket ssp-uploads-prod \
    --versioning-configuration Status=Enabled

# Set bucket policy (adjust as needed)
cat > bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowApplicationAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:role/SSP-EC2-Role"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::ssp-uploads-prod/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
    --bucket ssp-uploads-prod \
    --policy file://bucket-policy.json

# Enable CORS
cat > cors-config.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://yourdomain.com"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors \
    --bucket ssp-uploads-prod \
    --cors-configuration file://cors-config.json
```

---

## Step 3: Create IAM Role for EC2

```bash
# Create trust policy
cat > ec2-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create IAM role
aws iam create-role \
    --role-name SSP-EC2-Role \
    --assume-role-policy-document file://ec2-trust-policy.json

# Create and attach policy for S3 and Secrets Manager access
cat > ec2-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ssp-uploads-prod",
        "arn:aws:s3:::ssp-uploads-prod/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:ssp/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
EOF

aws iam put-role-policy \
    --role-name SSP-EC2-Role \
    --policy-name SSP-EC2-Policy \
    --policy-document file://ec2-policy.json

# Create instance profile
aws iam create-instance-profile \
    --instance-profile-name SSP-EC2-InstanceProfile

aws iam add-role-to-instance-profile \
    --instance-profile-name SSP-EC2-InstanceProfile \
    --role-name SSP-EC2-Role
```

---

## Step 4: Launch EC2 Instance

### 4.1 Create Security Group

```bash
# Create security group
aws ec2 create-security-group \
    --group-name ssp-app-sg \
    --description "Security group for SSP application servers" \
    --vpc-id vpc-xxxxxxxx

# Allow SSH (for management)
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxxxxx \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0

# Allow HTTP/HTTPS from ALB
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxxxxx \
    --protocol tcp \
    --port 3000 \
    --source-group sg-alb-xxxxxxxx

# Allow HTTPS
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxxxxx \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0
```

### 4.2 Create User Data Script

```bash
cat > user-data.sh <<'EOF'
#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2 for process management
npm install -g pm2

# Install git
apt-get install -y git

# Create application directory
mkdir -p /opt/ssp
cd /opt/ssp

# Clone repository (use deploy key or HTTPS with token)
git clone https://github.com/your-org/SSP.git .

# Install dependencies
pnpm install

# Build application
pnpm run build

# Fetch secrets from AWS Secrets Manager
aws secretsmanager get-secret-value \
    --secret-id ssp/app/env \
    --query SecretString \
    --output text > .env

# Start application with PM2
pm2 start dist/index.js --name ssp-app
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Configure CloudWatch Logs agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb

cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json <<'CWCONFIG'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/root/.pm2/logs/ssp-app-out.log",
            "log_group_name": "/aws/ec2/ssp-app",
            "log_stream_name": "{instance_id}/application"
          },
          {
            "file_path": "/root/.pm2/logs/ssp-app-error.log",
            "log_group_name": "/aws/ec2/ssp-app",
            "log_stream_name": "{instance_id}/error"
          }
        ]
      }
    }
  }
}
CWCONFIG

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json

echo "SSP application deployed successfully!"
EOF
```

### 4.3 Launch Instance

```bash
aws ec2 run-instances \
    --image-id ami-0c55b159cbfafe1f0 \
    --instance-type t3.medium \
    --key-name your-key-pair \
    --security-group-ids sg-xxxxxxxx \
    --subnet-id subnet-xxxxxxxx \
    --iam-instance-profile Name=SSP-EC2-InstanceProfile \
    --user-data file://user-data.sh \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=SSP-App-Server},{Key=Project,Value=SSP},{Key=Environment,Value=Production}]' \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]'
```

---

## Step 5: Set Up Application Load Balancer

### 5.1 Create Target Group

```bash
aws elbv2 create-target-group \
    --name ssp-app-tg \
    --protocol HTTP \
    --port 3000 \
    --vpc-id vpc-xxxxxxxx \
    --health-check-path /api/health \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3

# Register EC2 instance
aws elbv2 register-targets \
    --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/ssp-app-tg/xxxxxxxx \
    --targets Id=i-xxxxxxxxxxxxxxxxx
```

### 5.2 Create Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
    --name ssp-alb \
    --subnets subnet-xxxxxxxx subnet-yyyyyyyy \
    --security-groups sg-alb-xxxxxxxx \
    --scheme internet-facing \
    --type application \
    --ip-address-type ipv4

# Create HTTPS listener (requires ACM certificate)
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/ssp-alb/xxxxxxxx \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/ssp-app-tg/xxxxxxxx

# Create HTTP listener (redirect to HTTPS)
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/ssp-alb/xxxxxxxx \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}
```

---

## Step 6: Configure DNS with Route 53

```bash
# Create hosted zone (if not exists)
aws route53 create-hosted-zone \
    --name yourdomain.com \
    --caller-reference $(date +%s)

# Create A record pointing to ALB
cat > change-batch.json <<EOF
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "ssp-alb-xxxxxxxxxx.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
    --hosted-zone-id Z1234567890ABC \
    --change-batch file://change-batch.json
```

---

## Step 7: Set Up Auto Scaling (Optional)

```bash
# Create launch template
aws ec2 create-launch-template \
    --launch-template-name ssp-app-template \
    --version-description "SSP application template v1" \
    --launch-template-data '{
      "ImageId": "ami-0c55b159cbfafe1f0",
      "InstanceType": "t3.medium",
      "KeyName": "your-key-pair",
      "IamInstanceProfile": {"Name": "SSP-EC2-InstanceProfile"},
      "SecurityGroupIds": ["sg-xxxxxxxx"],
      "UserData": "'"$(base64 -w 0 user-data.sh)"'"
    }'

# Create Auto Scaling group
aws autoscaling create-auto-scaling-group \
    --auto-scaling-group-name ssp-asg \
    --launch-template LaunchTemplateName=ssp-app-template,Version=1 \
    --min-size 2 \
    --max-size 6 \
    --desired-capacity 2 \
    --target-group-arns arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/ssp-app-tg/xxxxxxxx \
    --vpc-zone-identifier "subnet-xxxxxxxx,subnet-yyyyyyyy" \
    --health-check-type ELB \
    --health-check-grace-period 300

# Create scaling policies
aws autoscaling put-scaling-policy \
    --auto-scaling-group-name ssp-asg \
    --policy-name scale-up \
    --policy-type TargetTrackingScaling \
    --target-tracking-configuration '{
      "PredefinedMetricSpecification": {
        "PredefinedMetricType": "ASGAverageCPUUtilization"
      },
      "TargetValue": 70.0
    }'
```

---

## Step 8: Configure CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build application
        run: pnpm run build
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to EC2
        run: |
          # Create deployment package
          tar -czf deploy.tar.gz dist/ package.json pnpm-lock.yaml
          
          # Upload to S3
          aws s3 cp deploy.tar.gz s3://ssp-deployments/$(date +%Y%m%d-%H%M%S)/deploy.tar.gz
          
          # Trigger deployment via SSM
          aws ssm send-command \
            --document-name "AWS-RunShellScript" \
            --targets "Key=tag:Name,Values=SSP-App-Server" \
            --parameters 'commands=[
              "cd /opt/ssp",
              "aws s3 cp s3://ssp-deployments/latest/deploy.tar.gz .",
              "tar -xzf deploy.tar.gz",
              "pnpm install --prod",
              "pm2 reload ssp-app"
            ]'
```

---

## Step 9: Monitoring and Logging

### CloudWatch Dashboard

Create a custom dashboard:

```bash
aws cloudwatch put-dashboard \
    --dashboard-name SSP-Production \
    --dashboard-body file://dashboard-config.json
```

### Set Up Alarms

```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
    --alarm-name ssp-high-cpu \
    --alarm-description "Alert when EC2 CPU exceeds 80%" \
    --metric-name CPUUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=InstanceId,Value=i-xxxxxxxxxxxxxxxxx \
    --alarm-actions arn:aws:sns:us-east-1:123456789012:ssp-alerts

# Application error rate alarm
aws cloudwatch put-metric-alarm \
    --alarm-name ssp-high-error-rate \
    --alarm-description "Alert when error rate exceeds 5%" \
    --metric-name 5XXError \
    --namespace AWS/ApplicationELB \
    --statistic Sum \
    --period 60 \
    --evaluation-periods 2 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=LoadBalancer,Value=app/ssp-alb/xxxxxxxx \
    --alarm-actions arn:aws:sns:us-east-1:123456789012:ssp-alerts
```

---

## Step 10: Verify Deployment

```bash
# Check application health
curl https://yourdomain.com/api/health

# Expected response:
# {"status":"ok","database":"connected","timestamp":"2025-11-17T..."}

# Check ALB target health
aws elbv2 describe-target-health \
    --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/ssp-app-tg/xxxxxxxx

# View application logs
aws logs tail /aws/ec2/ssp-app --follow
```

---

## Troubleshooting

### Application Won't Start

1.  SSH into EC2 instance
2.  Check PM2 logs:
    ```bash
    pm2 logs ssp-app
    ```
3.  Verify environment variables:
    ```bash
    cat /opt/ssp/.env
    ```
4.  Test database connection:
    ```bash
    cd /opt/ssp
    node -e "require('./dist/index.js')"
    ```

### 502 Bad Gateway from ALB

1.  Check target health:
    ```bash
    aws elbv2 describe-target-health --target-group-arn arn:...
    ```
2.  Verify security group allows traffic from ALB
3.  Check application is listening on correct port (3000)

---

## Security Checklist

- ✅ Use HTTPS only (redirect HTTP to HTTPS)
- ✅ Store secrets in AWS Secrets Manager
- ✅ Enable CloudTrail for audit logging
- ✅ Use IAM roles instead of access keys
- ✅ Restrict security groups to minimum required access
- ✅ Enable VPC Flow Logs
- ✅ Use AWS WAF for application firewall
- ✅ Enable GuardDuty for threat detection
- ✅ Regularly update dependencies and OS patches
- ✅ Implement rate limiting and DDoS protection

---

## Cost Optimization

-   Use **Spot Instances** for non-critical workloads
-   Enable **Auto Scaling** to match demand
-   Use **S3 Intelligent-Tiering** for uploads
-   Set up **CloudWatch Logs retention** policies
-   Use **Reserved Instances** for predictable workloads
-   Monitor costs with **AWS Cost Explorer**

---

## Next Steps

1.  Set up staging environment
2.  Implement blue-green deployment
3.  Configure WAF rules
4.  Set up backup and disaster recovery
5.  Implement monitoring dashboards
6.  Configure alerting and on-call rotation

For database deployment, see `AWS_RDS_DEPLOYMENT.md`.
