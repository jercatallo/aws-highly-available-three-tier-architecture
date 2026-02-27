import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

// Configuration
import { StackConfig } from '../config/stack-config';

// Constructs
import { VpcConstruct } from './constructs/networking/vpc-construct';
import { NetworkAclConstruct } from './constructs/networking/network-acl-construct';
import { SecurityGroupsConstruct } from './constructs/networking/security-group-construct';
import { AlbConstruct } from './constructs/load-balancing/alb-construct';
import { WebTierAsgConstruct } from './constructs/compute/web-tier-asg-construct';
import { AppTierAsgConstruct } from './constructs/compute/app-tier-asg-construct';
import { RdsConstruct } from './constructs/database/database-instance-construct';
import { OutputsConstruct } from './constructs/outputs/outputs-construct';

/**
 * AWS Highly Available 3-Tier Architecture Stack
 * 
 * This stack creates a highly available AWS infrastructure with:
 * - VPC with public and private subnets across 2-3 Availability Zones
 * - Application Load Balancer (ALB) in public subnets
 * - Web Tier ASG in private subnets (Presentation Layer)
 * - Application Tier ASG in private subnets (Business Logic Layer)
 * - RDS Multi-AZ database in isolated subnets (Data Layer)
 * - Network ACLs for subnet-level security
 * - Security groups for instance-level security (ALB -> Web Tier -> App Tier -> DB)
 * 
 * Architecture Pattern (3-Tier):
 * Internet -> Internet Gateway -> ALB (Public Subnets) -> 
 * Web Tier ASG (Private Subnets - Presentation Layer) -> 
 * App Tier ASG (Private Subnets - Business Logic Layer) -> 
 * RDS Database (Isolated Subnets - Data Layer)
 * NAT Gateways provide outbound internet access for both tiers
 * 
 * Best Practices Implemented:
 * - Class-based constructs for better organization
 * - Environment-based configuration (dev/staging/prod)
 * - Least privilege security group rules with tier isolation
 * - RDS Multi-AZ for database high availability
 * - Deletion protection for production environments
 * - IMDSv2 enforcement for EC2 instances
 * - VPC Flow Logs for network monitoring
 * - Comprehensive resource tagging
 */
export class HighlyAvailableStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = StackConfig.environment.name;
    const isProd = StackConfig.environment.isProd;

    // Apply tags to all resources in this stack
    Object.entries(StackConfig.tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
    cdk.Tags.of(this).add('Environment', environment);

    // 1. Create VPC with Multi-AZ support and Flow Logs
    const vpcConstruct = new VpcConstruct(this, 'VpcConstruct', {
      cidr: StackConfig.network.vpc.cidr,
      maxAzs: StackConfig.network.vpc.maxAzs,
      natGatewaysCount: StackConfig.network.vpc.natGatewaysCount,
      subnetCidrMask: StackConfig.network.vpc.subnetCidrMask,
      enableFlowLogs: StackConfig.network.vpc.enableFlowLogs,
      flowLogsRetentionDays: StackConfig.network.vpc.flowLogsRetentionDays,
      publicSubnetName: StackConfig.network.vpc.subnets.publicSubnetName,
      privateSubnetName: StackConfig.network.vpc.subnets.privateSubnetName,
      flowLogsTrafficType: StackConfig.network.vpc.flowLogs.trafficType,
      flowLogsRemovalPolicy: StackConfig.network.vpc.flowLogs.logGroupRemovalPolicy,
      vpcName: StackConfig.resourceNames.vpc,
      flowLogsGroupName: StackConfig.resourceNames.vpcFlowLogsGroup,
      flowLogName: StackConfig.resourceNames.vpcFlowLog,
    });

    // 2. Configure Network ACLs (subnet-level security)
    const networkAclConstruct = new NetworkAclConstruct(this, 'NetworkAclConstruct', {
      vpc: vpcConstruct.vpc,
      vpcCidr: StackConfig.network.vpc.cidr,
      httpPort: StackConfig.network.security.httpPort,
      httpsPort: StackConfig.network.security.httpsPort,
      dbPort: StackConfig.network.security.dbPort,
      httpInboundRuleNumber: StackConfig.network.networkAcls.rules.httpInboundRuleNumber,
      enableHttpInbound: StackConfig.network.networkAcls.rules.enableHttpInbound,
      httpsInboundRuleNumber: StackConfig.network.networkAcls.rules.httpsInboundRuleNumber,
      enableHttpsInbound: StackConfig.network.networkAcls.rules.enableHttpsInbound,
      ephemeralInboundRuleNumber: StackConfig.network.networkAcls.rules.ephemeralInboundRuleNumber,
      enableEphemeralInbound: StackConfig.network.networkAcls.rules.enableEphemeralInbound,
      allOutboundRuleNumber: StackConfig.network.networkAcls.rules.allOutboundRuleNumber,
      enableAllOutbound: StackConfig.network.networkAcls.rules.enableAllOutbound,
      privateHttpRuleNumber: StackConfig.network.networkAcls.rules.privateHttpRuleNumber,
      enablePrivateHttpInbound: StackConfig.network.networkAcls.rules.enablePrivateHttpInbound,
      privateDatabaseRuleNumber: StackConfig.network.networkAcls.rules.privateDatabaseRuleNumber,
      enablePrivateDatabaseInbound: StackConfig.network.networkAcls.rules.enablePrivateDatabaseInbound,
      privateEphemeralRuleNumber: StackConfig.network.networkAcls.rules.privateEphemeralRuleNumber,
      enablePrivateEphemeralInbound: StackConfig.network.networkAcls.rules.enablePrivateEphemeralInbound,
      enablePrivateAllOutbound: StackConfig.network.networkAcls.rules.enablePrivateAllOutbound,
      ephemeralPortStart: StackConfig.network.networkAcls.ephemeralPorts.start,
      ephemeralPortEnd: StackConfig.network.networkAcls.ephemeralPorts.end,
      publicNetworkAclName: StackConfig.resourceNames.publicNetworkAcl,
      privateNetworkAclName: StackConfig.resourceNames.privateNetworkAcl,
    });

    // 3. Create Security Groups (instance-level security with least privilege for 3-tier)
    const securityGroupsConstruct = new SecurityGroupsConstruct(this, 'SecurityGroupsConstruct', {
      vpc: vpcConstruct.vpc,
      allowHttpFrom: StackConfig.network.security.allowHttpFrom,
      httpPort: StackConfig.network.security.httpPort,
      httpsPort: StackConfig.network.security.httpsPort,
      appTierPort: StackConfig.network.security.appTierPort,
      dbPort: StackConfig.network.security.dbPort,
      albAllowAllOutbound: StackConfig.network.security.albAllowAllOutbound,
      webTierAllowAllOutbound: StackConfig.network.security.webTierAllowAllOutbound,
      appTierAllowAllOutbound: StackConfig.network.security.appTierAllowAllOutbound,
      dbAllowAllOutbound: StackConfig.network.security.dbAllowAllOutbound,
      allowPackageDownloads: StackConfig.network.security.allowPackageDownloads,
      albSecurityGroupName: StackConfig.resourceNames.albSecurityGroup,
      webTierSecurityGroupName: StackConfig.resourceNames.webTierSecurityGroup,
      appTierSecurityGroupName: StackConfig.resourceNames.appTierSecurityGroup,
      databaseSecurityGroupName: StackConfig.resourceNames.databaseSecurityGroup,
    });

    // 4. Create Application Load Balancer (forwards to Web Tier)
    const albConstruct = new AlbConstruct(this, 'AlbConstruct', {
      vpc: vpcConstruct.vpc,
      securityGroup: securityGroupsConstruct.albSecurityGroup,
      internetFacing: StackConfig.compute.alb.internetFacing,
      deletionProtection: StackConfig.compute.alb.deletionProtection,
      idleTimeout: StackConfig.compute.alb.idleTimeout,
      http2Enabled: StackConfig.compute.alb.http2Enabled,
      targetGroupPort: StackConfig.compute.alb.targetGroupPort,
      targetGroupProtocol: StackConfig.compute.alb.targetGroupProtocol,
      targetType: StackConfig.compute.alb.targetType,
      listenerPort: StackConfig.compute.alb.listenerPort,
      listenerProtocol: StackConfig.compute.alb.listenerProtocol,
      deregistrationDelay: StackConfig.compute.alb.deregistrationDelay,
      healthCheck: StackConfig.compute.alb.healthCheck,
      loadBalancerName: StackConfig.resourceNames.applicationLoadBalancer,
      targetGroupName: StackConfig.resourceNames.webTierTargetGroup,
      listenerName: StackConfig.resourceNames.httpListener,
    });

    // 5. Create Web Tier Auto Scaling Group (Presentation Layer)
    const webTierAsgConstruct = new WebTierAsgConstruct(this, 'WebTierAsgConstruct', {
      vpc: vpcConstruct.vpc,
      securityGroup: securityGroupsConstruct.webTierSecurityGroup,
      targetGroup: albConstruct.targetGroup,
      minCapacity: StackConfig.compute.webTier.minCapacity,
      maxCapacity: StackConfig.compute.webTier.maxCapacity,
      desiredCapacity: StackConfig.compute.webTier.desiredCapacity,
      instanceClass: StackConfig.compute.webTier.instanceClass,
      instanceSize: StackConfig.compute.webTier.instanceSize,
      machineImage: StackConfig.compute.webTier.machineImage,
      healthCheckType: StackConfig.compute.webTier.healthCheckType,
      healthCheckGracePeriod: StackConfig.compute.webTier.healthCheckGracePeriod,
      cooldown: StackConfig.compute.webTier.cooldown,
      targetCpuUtilization: StackConfig.compute.webTier.targetCpuUtilization,
      requireImdsv2: StackConfig.compute.webTier.requireImdsv2,
      subnetType: StackConfig.compute.webTier.subnetType,
      volumeSize: StackConfig.compute.storage.volumeSize,
      volumeType: StackConfig.compute.storage.volumeType,
      encrypted: StackConfig.compute.storage.encrypted,
      deleteOnTermination: StackConfig.compute.storage.deleteOnTermination,
      iops: StackConfig.compute.storage.iops,
      deviceName: StackConfig.compute.storage.deviceName,
      autoScalingGroupName: StackConfig.resourceNames.webTierAutoScalingGroup,
      cpuScalingPolicyName: StackConfig.resourceNames.webTierCpuScalingPolicy,
      userDataScriptPath: path.join(__dirname, '..', 'scripts', `web-tier-user-data-${environment}.sh`),
    });

    // 6. Create Application Tier Auto Scaling Group (Business Logic Layer)
    const appTierAsgConstruct = new AppTierAsgConstruct(this, 'AppTierAsgConstruct', {
      vpc: vpcConstruct.vpc,
      securityGroup: securityGroupsConstruct.appTierSecurityGroup,
      minCapacity: StackConfig.compute.appTier.minCapacity,
      maxCapacity: StackConfig.compute.appTier.maxCapacity,
      desiredCapacity: StackConfig.compute.appTier.desiredCapacity,
      instanceClass: StackConfig.compute.appTier.instanceClass,
      instanceSize: StackConfig.compute.appTier.instanceSize,
      machineImage: StackConfig.compute.appTier.machineImage,
      healthCheckType: StackConfig.compute.appTier.healthCheckType,
      healthCheckGracePeriod: StackConfig.compute.appTier.healthCheckGracePeriod,
      cooldown: StackConfig.compute.appTier.cooldown,
      targetCpuUtilization: StackConfig.compute.appTier.targetCpuUtilization,
      requireImdsv2: StackConfig.compute.appTier.requireImdsv2,
      subnetType: StackConfig.compute.appTier.subnetType,
      volumeSize: StackConfig.compute.storage.volumeSize,
      volumeType: StackConfig.compute.storage.volumeType,
      encrypted: StackConfig.compute.storage.encrypted,
      deleteOnTermination: StackConfig.compute.storage.deleteOnTermination,
      iops: StackConfig.compute.storage.iops,
      deviceName: StackConfig.compute.storage.deviceName,
      autoScalingGroupName: StackConfig.resourceNames.appTierAutoScalingGroup,
      cpuScalingPolicyName: StackConfig.resourceNames.appTierCpuScalingPolicy,
      userDataScriptPath: path.join(__dirname, '..', 'scripts', `app-tier-user-data-${environment}.sh`),
    });

    // 7. Create RDS Multi-AZ Database (Data Layer)
    const rdsConstruct = new RdsConstruct(this, 'RdsConstruct', {
      vpc: vpcConstruct.vpc,
      securityGroup: securityGroupsConstruct.dbSecurityGroup,
      engine: StackConfig.database.engine,
      engineVersion: StackConfig.database.engineVersion,
      instanceClass: StackConfig.database.instanceClass,
      instanceSize: StackConfig.database.instanceSize,
      allocatedStorage: StackConfig.database.allocatedStorage,
      maxAllocatedStorage: StackConfig.database.maxAllocatedStorage,
      multiAz: StackConfig.database.multiAz,
      databaseName: StackConfig.database.databaseName,
      backupRetention: StackConfig.database.backupRetention,
      preferredBackupWindow: StackConfig.database.preferredBackupWindow,
      preferredMaintenanceWindow: StackConfig.database.preferredMaintenanceWindow,
      deletionProtection: StackConfig.database.deletionProtection,
      removalPolicy: StackConfig.database.removalPolicy,
      storageEncrypted: StackConfig.database.storageEncrypted,
      autoMinorVersionUpgrade: StackConfig.database.autoMinorVersionUpgrade,
      credentialsUsername: StackConfig.database.credentials.username,
      credentialsPasswordLength: StackConfig.database.credentials.passwordLength,
      credentialsExcludePunctuation: StackConfig.database.credentials.excludePunctuation,
      credentialsIncludeSpace: StackConfig.database.credentials.includeSpace,
      cloudWatchLogsExports: StackConfig.database.cloudWatchLogs.exports,
      cloudWatchLogsRetention: StackConfig.database.cloudWatchLogs.retention,
      resourceName: StackConfig.resourceNames.database,
      subnetGroupName: StackConfig.resourceNames.databaseSubnetGroup,
      credentialsSecretName: StackConfig.resourceNames.databaseCredentials,
    });

    // Grant Application Tier instances access to database credentials
    // Only App Tier should have direct database access in 3-tier architecture
    rdsConstruct.secret.grantRead(appTierAsgConstruct.autoScalingGroup);

    // 8. Create CloudFormation Outputs
    const outputsConstruct = new OutputsConstruct(this, 'OutputsConstruct', {
      vpc: vpcConstruct.vpc,
      loadBalancer: albConstruct.loadBalancer,
      webTierAutoScalingGroup: webTierAsgConstruct.autoScalingGroup,
      appTierAutoScalingGroup: appTierAsgConstruct.autoScalingGroup,
      database: rdsConstruct.database,
      environment,
    });
  }
}
