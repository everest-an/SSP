# AWS RDS MySQL Deployment Guide

**Version**: 1.0  
**Date**: 2025-11-17

---

## Overview

This document provides step-by-step instructions for deploying the SSP system's MySQL database to AWS RDS (Relational Database Service).

---

## Prerequisites

-   AWS Account with appropriate permissions
-   AWS CLI installed and configured
-   SSH access to your EC2 instance (if deploying the application server)
-   Database credentials stored securely

---

## Step 1: Create RDS MySQL Instance

### Using AWS Console

1.  Navigate to **RDS** in the AWS Console
2.  Click **Create database**
3.  Select the following options:
    -   **Engine type**: MySQL
    -   **Version**: MySQL 8.0.x (latest stable)
    -   **Template**: Production (or Dev/Test for non-production)
    -   **DB instance identifier**: `ssp-mysql-db`
    -   **Master username**: `admin`
    -   **Master password**: (Use a strong password and store it securely in AWS Secrets Manager)
    -   **DB instance class**: `db.t3.medium` (adjust based on your workload)
    -   **Storage type**: General Purpose SSD (gp3)
    -   **Allocated storage**: 20 GB (with autoscaling enabled)
    -   **VPC**: Select your application VPC
    -   **Public access**: No (recommended for security)
    -   **VPC security group**: Create a new security group or select an existing one
    -   **Database name**: `ssp_db`
    -   **Backup retention**: 7 days (adjust as needed)
    -   **Enable encryption**: Yes
    -   **Enable Enhanced Monitoring**: Yes (optional but recommended)

4.  Click **Create database**

### Using AWS CLI

```bash
aws rds create-db-instance \
    --db-instance-identifier ssp-mysql-db \
    --db-instance-class db.t3.medium \
    --engine mysql \
    --engine-version 8.0.39 \
    --master-username admin \
    --master-user-password YOUR_SECURE_PASSWORD \
    --allocated-storage 20 \
    --storage-type gp3 \
    --vpc-security-group-ids sg-xxxxxxxxx \
    --db-subnet-group-name your-db-subnet-group \
    --backup-retention-period 7 \
    --preferred-backup-window "03:00-04:00" \
    --preferred-maintenance-window "mon:04:00-mon:05:00" \
    --enable-cloudwatch-logs-exports '["error","general","slowquery"]' \
    --storage-encrypted \
    --db-name ssp_db \
    --tags Key=Project,Value=SSP Key=Environment,Value=Production
```

---

## Step 2: Configure Security Group

Your RDS instance needs to allow incoming connections from your application servers.

1.  Navigate to **EC2 > Security Groups**
2.  Find the security group associated with your RDS instance
3.  Add an inbound rule:
    -   **Type**: MySQL/Aurora
    -   **Protocol**: TCP
    -   **Port**: 3306
    -   **Source**: Security group of your EC2 application servers (or specific CIDR blocks)

---

## Step 3: Store Database Credentials in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
    --name ssp/database/credentials \
    --description "SSP Database Credentials" \
    --secret-string '{
        "username": "admin",
        "password": "YOUR_SECURE_PASSWORD",
        "engine": "mysql",
        "host": "ssp-mysql-db.xxxxxx.us-east-1.rds.amazonaws.com",
        "port": 3306,
        "dbname": "ssp_db"
    }'
```

---

## Step 4: Apply Database Schema

### Option A: From Local Machine (via Bastion Host)

If your RDS instance is in a private subnet, you'll need to connect through a bastion host:

```bash
# SSH tunnel through bastion
ssh -i your-key.pem -L 3307:ssp-mysql-db.xxxxxx.us-east-1.rds.amazonaws.com:3306 ubuntu@bastion-host-ip

# In another terminal, update your .env file
DATABASE_URL=mysql://admin:YOUR_PASSWORD@localhost:3307/ssp_db

# Apply schema
cd /path/to/SSP
pnpm exec drizzle-kit push
```

### Option B: From EC2 Instance

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Clone the repository
git clone https://github.com/your-org/SSP.git
cd SSP

# Install dependencies
pnpm install

# Set environment variable
export DATABASE_URL="mysql://admin:YOUR_PASSWORD@ssp-mysql-db.xxxxxx.us-east-1.rds.amazonaws.com:3306/ssp_db"

# Apply schema
pnpm exec drizzle-kit push
```

---

## Step 5: Update Application Configuration

Update your application's environment variables to use the RDS endpoint:

```bash
# On your EC2 instance or in your deployment configuration
export DATABASE_URL="mysql://admin:YOUR_PASSWORD@ssp-mysql-db.xxxxxx.us-east-1.rds.amazonaws.com:3306/ssp_db"
export JWT_SECRET="your-production-jwt-secret"
export STRIPE_SECRET_KEY="sk_live_your_stripe_key"
# ... other environment variables
```

For production, it's recommended to use AWS Systems Manager Parameter Store or Secrets Manager to manage these secrets.

---

## Step 6: Test Database Connection

Create a simple test script:

```javascript
// test-db-connection.js
import mysql from 'mysql2/promise';

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: 'ssp-mysql-db.xxxxxx.us-east-1.rds.amazonaws.com',
      user: 'admin',
      password: 'YOUR_PASSWORD',
      database: 'ssp_db',
    });

    console.log('✅ Database connection successful!');
    
    const [rows] = await connection.execute('SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = ?', ['ssp_db']);
    console.log(`📊 Number of tables: ${rows[0].table_count}`);
    
    await connection.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
```

Run the test:

```bash
node test-db-connection.js
```

---

## Step 7: Enable Automated Backups

RDS automatically creates backups, but you should verify the configuration:

1.  Navigate to your RDS instance in the AWS Console
2.  Check **Backup** settings:
    -   **Automated backups**: Enabled
    -   **Backup retention period**: 7 days (or more for production)
    -   **Backup window**: Set to a low-traffic period
3.  Consider creating a manual snapshot before major deployments

---

## Step 8: Set Up Monitoring and Alerts

### CloudWatch Alarms

Create alarms for critical metrics:

```bash
# High CPU utilization
aws cloudwatch put-metric-alarm \
    --alarm-name ssp-rds-high-cpu \
    --alarm-description "Alert when RDS CPU exceeds 80%" \
    --metric-name CPUUtilization \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=DBInstanceIdentifier,Value=ssp-mysql-db \
    --alarm-actions arn:aws:sns:us-east-1:123456789012:ssp-alerts

# Low free storage
aws cloudwatch put-metric-alarm \
    --alarm-name ssp-rds-low-storage \
    --alarm-description "Alert when RDS free storage is below 2GB" \
    --metric-name FreeStorageSpace \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 2000000000 \
    --comparison-operator LessThanThreshold \
    --dimensions Name=DBInstanceIdentifier,Value=ssp-mysql-db \
    --alarm-actions arn:aws:sns:us-east-1:123456789012:ssp-alerts
```

---

## Step 9: Performance Optimization

### Enable Performance Insights

```bash
aws rds modify-db-instance \
    --db-instance-identifier ssp-mysql-db \
    --enable-performance-insights \
    --performance-insights-retention-period 7 \
    --apply-immediately
```

### Configure Parameter Group

Create a custom parameter group for MySQL optimization:

```bash
aws rds create-db-parameter-group \
    --db-parameter-group-name ssp-mysql-params \
    --db-parameter-group-family mysql8.0 \
    --description "Custom parameters for SSP MySQL"

# Set parameters
aws rds modify-db-parameter-group \
    --db-parameter-group-name ssp-mysql-params \
    --parameters "ParameterName=max_connections,ParameterValue=200,ApplyMethod=immediate" \
                 "ParameterName=innodb_buffer_pool_size,ParameterValue={DBInstanceClassMemory*3/4},ApplyMethod=pending-reboot"

# Apply parameter group to instance
aws rds modify-db-instance \
    --db-instance-identifier ssp-mysql-db \
    --db-parameter-group-name ssp-mysql-params
```

---

## Step 10: Disaster Recovery Plan

### Read Replica (Optional)

For high availability, create a read replica in another availability zone:

```bash
aws rds create-db-instance-read-replica \
    --db-instance-identifier ssp-mysql-db-replica \
    --source-db-instance-identifier ssp-mysql-db \
    --db-instance-class db.t3.medium \
    --availability-zone us-east-1b
```

### Cross-Region Backup (Optional)

For disaster recovery, enable cross-region automated backups:

```bash
aws rds start-db-instance-automated-backups-replication \
    --source-db-instance-arn arn:aws:rds:us-east-1:123456789012:db:ssp-mysql-db \
    --backup-retention-period 7 \
    --region us-west-2
```

---

## Troubleshooting

### Cannot Connect to RDS Instance

1.  **Check security group rules**: Ensure port 3306 is open for your application servers
2.  **Verify VPC configuration**: Ensure your EC2 instances and RDS are in the same VPC or have proper peering
3.  **Check credentials**: Verify username and password are correct
4.  **Test with MySQL client**:
    ```bash
    mysql -h ssp-mysql-db.xxxxxx.us-east-1.rds.amazonaws.com -u admin -p ssp_db
    ```

### Slow Query Performance

1.  Enable **Performance Insights** in RDS console
2.  Check **CloudWatch Metrics** for CPU, memory, and IOPS
3.  Review slow query logs:
    ```bash
    aws rds download-db-log-file-portion \
        --db-instance-identifier ssp-mysql-db \
        --log-file-name slowquery/mysql-slowquery.log
    ```

---

## Cost Optimization

-   Use **Reserved Instances** for production workloads (up to 60% savings)
-   Enable **Storage Autoscaling** to avoid over-provisioning
-   Use **db.t3** or **db.t4g** instances for development/staging
-   Set appropriate **backup retention periods** (7 days is usually sufficient)
-   Delete old **manual snapshots** regularly

---

## Security Best Practices

1.  ✅ Enable encryption at rest
2.  ✅ Use SSL/TLS for connections
3.  ✅ Store credentials in AWS Secrets Manager
4.  ✅ Enable automated backups
5.  ✅ Restrict security group access to application servers only
6.  ✅ Enable CloudWatch Logs for audit trails
7.  ✅ Regularly update to the latest MySQL version
8.  ✅ Use IAM database authentication (optional but recommended)

---

## Next Steps

After deploying the database:

1.  Deploy the SSP application to EC2 or ECS
2.  Configure load balancing with ALB
3.  Set up CI/CD pipeline with GitHub Actions
4.  Configure domain and SSL certificate
5.  Implement monitoring and alerting

For application deployment, refer to `AWS_APPLICATION_DEPLOYMENT.md`.
