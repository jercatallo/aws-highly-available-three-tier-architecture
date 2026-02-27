#!/bin/bash
set -e

# Install Node.js and npm (for application server)
sudo dnf install -y nodejs npm || (curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo dnf install -y nodejs)

# Get instance metadata using IMDSv2
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)
AVAILABILITY_ZONE=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)
PRIVATE_IP=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/local-ipv4)

# Create application directory
sudo mkdir -p /opt/app
cd /opt/app

# Create a simple Node.js application server
cat <<'EOF' | sudo tee /opt/app/server.js
const http = require('http');
const os = require('os');

const PORT = 8080;
const INSTANCE_ID = process.env.INSTANCE_ID || 'unknown';
const AVAILABILITY_ZONE = process.env.AVAILABILITY_ZONE || 'unknown';
const PRIVATE_IP = process.env.PRIVATE_IP || 'unknown';

const server = http.createServer((req, res) => {
  const response = {
    message: 'Application Tier - Business Logic Layer',
    timestamp: new Date().toISOString(),
    instanceId: INSTANCE_ID,
    availabilityZone: AVAILABILITY_ZONE,
    privateIp: PRIVATE_IP,
    hostname: os.hostname(),
    tier: 'Application Tier',
    architecture: '3-Tier',
    environment: 'Staging',
    path: req.url,
    method: req.method,
    status: 'healthy'
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response, null, 2));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Application Tier server running on port ${PORT}`);
  console.log(`Instance ID: ${INSTANCE_ID}`);
  console.log(`Availability Zone: ${AVAILABILITY_ZONE}`);
  console.log(`Private IP: ${PRIVATE_IP}`);
});

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  }
});
EOF

# Create systemd service for the application
cat <<EOF | sudo tee /etc/systemd/system/app-tier.service
[Unit]
Description=Application Tier Node.js Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/app
Environment="INSTANCE_ID=$INSTANCE_ID"
Environment="AVAILABILITY_ZONE=$AVAILABILITY_ZONE"
Environment="PRIVATE_IP=$PRIVATE_IP"
Environment="NODE_ENV=staging"
ExecStart=/usr/bin/node /opt/app/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=app-tier

[Install]
WantedBy=multi-user.target
EOF

# Set proper ownership
sudo chown -R ec2-user:ec2-user /opt/app

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable app-tier
sudo systemctl start app-tier

# Wait for service to be ready
sleep 5

# Verify the service is running
sudo systemctl status app-tier
