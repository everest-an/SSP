#!/bin/bash
set -e

echo "🚀 SSP AWS Deployment Script"
echo "=============================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is logged in to AWS
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ Not logged in to AWS. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI configured"
echo ""

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}

echo "📋 Deployment Configuration:"
echo "   Account ID: $AWS_ACCOUNT_ID"
echo "   Region: $AWS_REGION"
echo ""

# Prompt for environment
read -p "Enter environment (dev/staging/prod): " ENVIRONMENT
ENVIRONMENT=${ENVIRONMENT:-dev}

echo ""
echo "🔧 Step 1: Creating S3 bucket for uploads..."
S3_BUCKET="ssp-uploads-${ENVIRONMENT}-${AWS_ACCOUNT_ID}"
aws s3 mb s3://${S3_BUCKET} --region ${AWS_REGION} 2>/dev/null || echo "   Bucket already exists"
echo "   ✅ S3 bucket: ${S3_BUCKET}"

echo ""
echo "🔧 Step 2: Creating IAM role for EC2..."
# Create IAM role (simplified version)
cat > /tmp/ec2-trust-policy.json <<TRUST
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ec2.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
TRUST

aws iam create-role \
    --role-name SSP-EC2-Role-${ENVIRONMENT} \
    --assume-role-policy-document file:///tmp/ec2-trust-policy.json 2>/dev/null || echo "   Role already exists"

aws iam attach-role-policy \
    --role-name SSP-EC2-Role-${ENVIRONMENT} \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess 2>/dev/null || true

aws iam attach-role-policy \
    --role-name SSP-EC2-Role-${ENVIRONMENT} \
    --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite 2>/dev/null || true

echo "   ✅ IAM role created"

echo ""
echo "🔧 Step 3: Building application..."
pnpm install
pnpm run build
echo "   ✅ Application built"

echo ""
echo "🔧 Step 4: Creating deployment package..."
tar -czf /tmp/ssp-deploy.tar.gz dist/ package.json pnpm-lock.yaml drizzle/ server/
echo "   ✅ Deployment package created"

echo ""
echo "🔧 Step 5: Uploading to S3..."
aws s3 cp /tmp/ssp-deploy.tar.gz s3://${S3_BUCKET}/deployments/$(date +%Y%m%d-%H%M%S).tar.gz
aws s3 cp /tmp/ssp-deploy.tar.gz s3://${S3_BUCKET}/deployments/latest.tar.gz
echo "   ✅ Uploaded to S3"

echo ""
echo "✅ Deployment preparation complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Create RDS MySQL instance (see AWS_RDS_DEPLOYMENT.md)"
echo "   2. Launch EC2 instance with SSP-EC2-Role-${ENVIRONMENT}"
echo "   3. SSH into EC2 and run:"
echo "      aws s3 cp s3://${S3_BUCKET}/deployments/latest.tar.gz ."
echo "      tar -xzf latest.tar.gz"
echo "      pnpm install --prod"
echo "      pm2 start dist/index.js --name ssp-app"
echo ""
echo "For detailed instructions, see AWS_APPLICATION_DEPLOYMENT.md"
