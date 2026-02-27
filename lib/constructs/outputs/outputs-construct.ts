import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface OutputsConstructProps {
  vpc: ec2.Vpc;
  loadBalancer: elbv2.ApplicationLoadBalancer;
  webTierAutoScalingGroup: autoscaling.AutoScalingGroup;
  appTierAutoScalingGroup: autoscaling.AutoScalingGroup;
  database: rds.DatabaseInstance;
  environment: string;
}

/**
 * Outputs Construct for 3-Tier Architecture Stack Information
 * 
 * Creates CloudFormation outputs for the highly available 3-tier architecture
 * 
 * These outputs will be displayed after deployment and can be
 * referenced by other stacks or used for documentation.
 * 
 * Key outputs:
 * - Application Load Balancer DNS name (your application URL)
 * - VPC information
 * - Web Tier Auto Scaling Group details
 * - Application Tier Auto Scaling Group details
 * - Database connection information
 */
export class OutputsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: OutputsConstructProps) {
    super(scope, id);

    const exportPrefix = `${props.environment}-HighlyAvailable3Tier`;

    // VPC Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: props.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${exportPrefix}-VpcId`,
    });

    new cdk.CfnOutput(this, 'VpcCidr', {
      value: props.vpc.vpcCidrBlock,
      description: 'VPC CIDR Block',
      exportName: `${exportPrefix}-VpcCidr`,
    });

    // ALB Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: props.loadBalancer.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name (Use this URL to access your application)',
      exportName: `${exportPrefix}-LoadBalancerDNS`,
    });

    new cdk.CfnOutput(this, 'LoadBalancerARN', {
      value: props.loadBalancer.loadBalancerArn,
      description: 'Application Load Balancer ARN',
      exportName: `${exportPrefix}-LoadBalancerARN`,
    });

    new cdk.CfnOutput(this, 'ApplicationURL', {
      value: `http://${props.loadBalancer.loadBalancerDnsName}`,
      description: 'Full Application URL',
    });

    // Web Tier Auto Scaling Group Outputs
    new cdk.CfnOutput(this, 'WebTierAutoScalingGroupName', {
      value: props.webTierAutoScalingGroup.autoScalingGroupName,
      description: 'Web Tier Auto Scaling Group Name',
      exportName: `${exportPrefix}-WebTierAutoScalingGroupName`,
    });

    new cdk.CfnOutput(this, 'WebTierAutoScalingGroupARN', {
      value: props.webTierAutoScalingGroup.autoScalingGroupArn,
      description: 'Web Tier Auto Scaling Group ARN',
      exportName: `${exportPrefix}-WebTierAutoScalingGroupARN`,
    });

    // Application Tier Auto Scaling Group Outputs
    new cdk.CfnOutput(this, 'AppTierAutoScalingGroupName', {
      value: props.appTierAutoScalingGroup.autoScalingGroupName,
      description: 'Application Tier Auto Scaling Group Name',
      exportName: `${exportPrefix}-AppTierAutoScalingGroupName`,
    });

    new cdk.CfnOutput(this, 'AppTierAutoScalingGroupARN', {
      value: props.appTierAutoScalingGroup.autoScalingGroupArn,
      description: 'Application Tier Auto Scaling Group ARN',
      exportName: `${exportPrefix}-AppTierAutoScalingGroupARN`,
    });

    // Database Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: props.database.dbInstanceEndpointAddress,
      description: 'RDS Database Endpoint Address',
      exportName: `${exportPrefix}-DatabaseEndpoint`,
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: props.database.dbInstanceEndpointPort,
      description: 'RDS Database Port',
      exportName: `${exportPrefix}-DatabasePort`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: props.database.secret?.secretArn || 'N/A',
      description: 'ARN of the secret containing database credentials',
    });
  }
}
