import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface SecurityGroupsConstructProps {
  vpc: ec2.Vpc;
  allowHttpFrom: string;
  httpPort: number;
  httpsPort: number;
  appTierPort: number;
  dbPort: number;
  albAllowAllOutbound?: boolean;
  webTierAllowAllOutbound?: boolean;
  appTierAllowAllOutbound?: boolean;
  dbAllowAllOutbound?: boolean;
  allowPackageDownloads?: boolean;
  albSecurityGroupName?: string;
  webTierSecurityGroupName?: string;
  appTierSecurityGroupName?: string;
  databaseSecurityGroupName?: string;
}

/**
 * Security Groups Construct with Least Privilege Access for 3-Tier Architecture
 * 
 * Creates security groups for ALB, Web Tier, App Tier, and Database with proper isolation
 * 
 * Security Groups are stateful firewalls at the instance level.
 * Traffic flow: Internet -> ALB -> Web Tier -> App Tier -> Database
 * 
 * ALB Security Group: Allows HTTP/HTTPS from internet, outbound only to Web Tier
 * Web Tier Security Group: Allows HTTP from ALB only, outbound to App Tier
 * App Tier Security Group: Allows traffic from Web Tier only, outbound to Database
 * Database Security Group: Allows MySQL from App Tier only, no outbound
 */
export class SecurityGroupsConstruct extends Construct {
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly webTierSecurityGroup: ec2.SecurityGroup;
  public readonly appTierSecurityGroup: ec2.SecurityGroup;
  public readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityGroupsConstructProps) {
    super(scope, id);

    // ALB Security Group - Internet-facing
    this.albSecurityGroup = new ec2.SecurityGroup(this, props.albSecurityGroupName || 'AlbSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: props.albAllowAllOutbound ?? false, // Restrict outbound - will add specific rules
    });

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.allowHttpFrom),
      ec2.Port.tcp(props.httpPort),
      'Allow HTTP traffic from internet'
    );

    // Web Tier Security Group - For web instances (presentation layer)
    this.webTierSecurityGroup = new ec2.SecurityGroup(this, props.webTierSecurityGroupName || 'WebTierSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Web Tier instances',
      allowAllOutbound: props.webTierAllowAllOutbound ?? false, // Restrict outbound - will add specific rules
    });

    // SECURITY BEST PRACTICE: Web Tier only accepts traffic from ALB
    this.webTierSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(props.httpPort),
      'Allow HTTP traffic from ALB only'
    );

    // ALB can send traffic to Web Tier
    this.albSecurityGroup.addEgressRule(
      this.webTierSecurityGroup,
      ec2.Port.tcp(props.httpPort),
      'Allow outbound to Web Tier instances'
    );

    // App Tier Security Group - For application instances (business logic layer)
    this.appTierSecurityGroup = new ec2.SecurityGroup(this, props.appTierSecurityGroupName || 'AppTierSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Application Tier instances',
      allowAllOutbound: props.appTierAllowAllOutbound ?? false, // Restrict outbound - will add specific rules
    });

    // SECURITY BEST PRACTICE: App Tier only accepts traffic from Web Tier
    this.appTierSecurityGroup.addIngressRule(
      this.webTierSecurityGroup,
      ec2.Port.tcp(props.appTierPort),
      'Allow traffic from Web Tier only'
    );

    // Web Tier can send traffic to App Tier
    this.webTierSecurityGroup.addEgressRule(
      this.appTierSecurityGroup,
      ec2.Port.tcp(props.appTierPort),
      'Allow outbound to App Tier instances'
    );

    // Database Security Group
    this.dbSecurityGroup = new ec2.SecurityGroup(this, props.databaseSecurityGroupName || 'DatabaseSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for RDS database',
      allowAllOutbound: props.dbAllowAllOutbound ?? false, // Database should not initiate outbound connections
    });

    // SECURITY BEST PRACTICE: Database only accepts traffic from App Tier instances
    this.dbSecurityGroup.addIngressRule(
      this.appTierSecurityGroup,
      ec2.Port.tcp(props.dbPort),
      'Allow MySQL/MariaDB traffic from App Tier instances only'
    );

    // App Tier can connect to database
    this.appTierSecurityGroup.addEgressRule(
      this.dbSecurityGroup,
      ec2.Port.tcp(props.dbPort),
      'Allow outbound to database'
    );

    // Web Tier needs internet access for updates (via NAT Gateway)
    if (props.allowPackageDownloads ?? true) {
      this.webTierSecurityGroup.addEgressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(props.httpPort),
        'Allow HTTP for package downloads'
      );

      this.webTierSecurityGroup.addEgressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(props.httpsPort),
        'Allow HTTPS for package downloads'
      );

      // App Tier also needs internet access for updates (via NAT Gateway)
      this.appTierSecurityGroup.addEgressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(props.httpPort),
        'Allow HTTP for package downloads'
      );

      this.appTierSecurityGroup.addEgressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(props.httpsPort),
        'Allow HTTPS for package downloads'
      );
    }
  }
}
