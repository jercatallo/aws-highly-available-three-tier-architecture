import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { HighlyAvailableStack } from '../lib/stack';

describe('Stack - Highly Available 3-Tier Architecture', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new HighlyAvailableStack(app, 'WebApp-Dev-MultiAZ-3TierInfra', {
      env: { region: 'us-west-2' },
    });
    template = Template.fromStack(stack);
  });

  describe('VPC Configuration', () => {
    test('VPC is created with correct CIDR', () => {
      template.resourceCountIs('AWS::EC2::VPC', 1);
      template.hasResourceProperties('AWS::EC2::VPC', {
        CidrBlock: '10.0.0.0/16',
      });
    });

    test('Creates correct number of subnets for 2 AZs', () => {
      // 2 AZs * 3 subnet types (public + private + isolated) = 6 subnets
      template.resourceCountIs('AWS::EC2::Subnet', 6);
    });

    test('Creates NAT Gateways for high availability', () => {
      // 2 NAT Gateways (one per AZ)
      template.resourceCountIs('AWS::EC2::NatGateway', 2);
    });

    test('Creates Internet Gateway', () => {
      template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    });
  });

  describe('Security Groups', () => {
    test('Creates ALB security group', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Security group for Application Load Balancer',
      });
    });

    test('Creates Web Tier security group', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Security group for Web Tier instances',
      });
    });

    test('Creates Application Tier security group', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Security group for Application Tier instances',
      });
    });

    test('Creates database security group', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Security group for RDS database',
      });
    });

    test('Creates four security groups total', () => {
      template.resourceCountIs('AWS::EC2::SecurityGroup', 4);
    });
  });

  describe('Application Load Balancer', () => {
    test('Creates Application Load Balancer', () => {
      template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Type: 'application',
        Scheme: 'internet-facing',
      });
    });

    test('Creates target group', () => {
      template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 1);
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
        Port: 80,
        Protocol: 'HTTP',
        TargetType: 'instance',
      });
    });

    test('Creates HTTP listener', () => {
      template.resourceCountIs('AWS::ElasticLoadBalancingV2::Listener', 1);
      template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
        Port: 80,
        Protocol: 'HTTP',
      });
    });
  });

  describe('Auto Scaling Groups', () => {
    test('Creates two Auto Scaling Groups (Web and App tiers)', () => {
      template.resourceCountIs('AWS::AutoScaling::AutoScalingGroup', 2);
    });

    test('Web Tier ASG is configured correctly', () => {
      // Verify Web Tier ASG exists with proper configuration
      template.hasResourceProperties('AWS::AutoScaling::AutoScalingGroup', {
        MinSize: '2',
        MaxSize: '6',
        DesiredCapacity: '2',
        HealthCheckType: 'ELB',
      });
    });

    test('Application Tier ASG is configured correctly', () => {
      // Verify App Tier ASG exists with proper configuration
      template.hasResourceProperties('AWS::AutoScaling::AutoScalingGroup', {
        MinSize: '2',
        MaxSize: '6',
        DesiredCapacity: '2',
        HealthCheckType: 'EC2',
      });
    });

    test('Creates CPU-based scaling policies', () => {
      template.hasResourceProperties('AWS::AutoScaling::ScalingPolicy', {
        PolicyType: 'TargetTrackingScaling',
      });
    });
  });

  describe('RDS Database', () => {
    test('Creates RDS database instance', () => {
      template.resourceCountIs('AWS::RDS::DBInstance', 1);
    });

    test('Database is Multi-AZ enabled', () => {
      template.hasResourceProperties('AWS::RDS::DBInstance', {
        MultiAZ: true,
      });
    });

    test('Database has encrypted storage', () => {
      template.hasResourceProperties('AWS::RDS::DBInstance', {
        StorageEncrypted: true,
      });
    });

    test('Creates database secret', () => {
      template.resourceCountIs('AWS::SecretsManager::Secret', 1);
    });
  });

  describe('Network ACLs', () => {
    test('Creates Network ACLs', () => {
      template.resourceCountIs('AWS::EC2::NetworkAcl', 2);
    });

    test('Network ACLs have correct ingress rules', () => {
      template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
        RuleNumber: 100,
        Protocol: 6, // TCP
        RuleAction: 'allow',
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    test('Creates VPC outputs', () => {
      const outputs = template.findOutputs('*');
      expect(Object.keys(outputs).some(key => outputs[key].Description === 'VPC ID')).toBe(true);
      expect(Object.keys(outputs).some(key => outputs[key].Description === 'VPC CIDR Block')).toBe(true);
    });

    test('Creates ALB outputs', () => {
      const outputs = template.findOutputs('*');
      expect(Object.keys(outputs).some(key => outputs[key].Description?.includes('Load Balancer DNS'))).toBe(true);
      expect(Object.keys(outputs).some(key => outputs[key].Description?.includes('Load Balancer ARN'))).toBe(true);
      expect(Object.keys(outputs).some(key => outputs[key].Description?.includes('Application URL'))).toBe(true);
    });

    test('Creates ASG outputs', () => {
      const outputs = template.findOutputs('*');
      expect(Object.keys(outputs).some(key => outputs[key].Description === 'Web Tier Auto Scaling Group Name')).toBe(true);
      expect(Object.keys(outputs).some(key => outputs[key].Description === 'Web Tier Auto Scaling Group ARN')).toBe(true);
      expect(Object.keys(outputs).some(key => outputs[key].Description === 'Application Tier Auto Scaling Group Name')).toBe(true);
      expect(Object.keys(outputs).some(key => outputs[key].Description === 'Application Tier Auto Scaling Group ARN')).toBe(true);
    });
  });
});
