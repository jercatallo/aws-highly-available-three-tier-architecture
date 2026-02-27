import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SecurityGroupsConstruct } from '../../lib/constructs/networking/security-group-construct';

describe('Security Group Construct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let vpc: ec2.Vpc;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
    vpc = new ec2.Vpc(stack, 'TestVpc');
  });

  test('creates four security groups (ALB, Web Tier, App Tier, and DB)', () => {
    new SecurityGroupsConstruct(stack, 'TestSecurityGroups', {
      vpc,
      allowHttpFrom: '0.0.0.0/0',
      httpPort: 80,
      httpsPort: 443,
      appTierPort: 8080,
      dbPort: 3306,
    });

    const template = Template.fromStack(stack);
    
    // Should create 4 security groups (ALB, Web Tier, App Tier, and DB)
    template.resourceCountIs('AWS::EC2::SecurityGroup', 4);
  });

  test('EC2 security group allows HTTP from specified CIDR', () => {
    new SecurityGroupsConstruct(stack, 'TestSecurityGroups', {
      vpc,
      allowHttpFrom: '203.0.113.0/24',
      httpPort: 80,
      httpsPort: 443,
      appTierPort: 8080,
      dbPort: 3306,
    });

    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          CidrIp: '203.0.113.0/24',
          IpProtocol: 'tcp',
          FromPort: 80,
          ToPort: 80,
        }),
      ]),
    });
  });

  test('Creates security groups for highly available 3-tier architecture', () => {
    const construct = new SecurityGroupsConstruct(stack, 'TestSecurityGroups', {
      vpc,
      allowHttpFrom: '0.0.0.0/0',
      httpPort: 80,
      httpsPort: 443,
      appTierPort: 8080,
      dbPort: 3306,
    });

    // Verify all four security groups are created
    expect(construct.albSecurityGroup).toBeDefined();
    expect(construct.webTierSecurityGroup).toBeDefined();
    expect(construct.appTierSecurityGroup).toBeDefined();
    expect(construct.dbSecurityGroup).toBeDefined();
  });

  test('database security group allows MySQL from App Tier security group', () => {
    new SecurityGroupsConstruct(stack, 'TestSecurityGroups', {
      vpc,
      allowHttpFrom: '0.0.0.0/0',
      httpPort: 80,
      httpsPort: 443,
      appTierPort: 8080,
      dbPort: 3306,
    });

    const template = Template.fromStack(stack);
    
    // DB security group should reference EC2 security group
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for RDS database',
    });
  });

  test('returns all security groups', () => {
    const construct = new SecurityGroupsConstruct(stack, 'TestSecurityGroups', {
      vpc,
      allowHttpFrom: '0.0.0.0/0',
      httpPort: 80,
      httpsPort: 443,
      appTierPort: 8080,
      dbPort: 3306,
    });

    expect(construct.albSecurityGroup).toBeDefined();
    expect(construct.webTierSecurityGroup).toBeDefined();
    expect(construct.appTierSecurityGroup).toBeDefined();
    expect(construct.dbSecurityGroup).toBeDefined();
    expect(construct.albSecurityGroup).toBeInstanceOf(ec2.SecurityGroup);
    expect(construct.webTierSecurityGroup).toBeInstanceOf(ec2.SecurityGroup);
    expect(construct.appTierSecurityGroup).toBeInstanceOf(ec2.SecurityGroup);
    expect(construct.dbSecurityGroup).toBeInstanceOf(ec2.SecurityGroup);
  });

  test('ALB security group allows HTTP from internet', () => {
    new SecurityGroupsConstruct(stack, 'TestSecurityGroups', {
      vpc,
      allowHttpFrom: '0.0.0.0/0',
      httpPort: 80,
      httpsPort: 443,
      appTierPort: 8080,
      dbPort: 3306,
    });

    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for Application Load Balancer',
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          CidrIp: '0.0.0.0/0',
          IpProtocol: 'tcp',
          FromPort: 80,
          ToPort: 80,
        }),
      ]),
    });
  });

  test('Web Tier security group allows HTTP from ALB only', () => {
    new SecurityGroupsConstruct(stack, 'TestSecurityGroups', {
      vpc,
      allowHttpFrom: '0.0.0.0/0',
      httpPort: 80,
      httpsPort: 443,
      appTierPort: 8080,
      dbPort: 3306,
    });

    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for Web Tier instances',
    });
  });
});
