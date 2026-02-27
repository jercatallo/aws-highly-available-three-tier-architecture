import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

export interface AppTierAsgConstructProps {
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  minCapacity: number;
  maxCapacity: number;
  desiredCapacity: number;
  instanceClass: ec2.InstanceClass;
  instanceSize: ec2.InstanceSize;
  machineImage: ec2.IMachineImage;
  healthCheckType: string;
  healthCheckGracePeriod: number;
  cooldown: number;
  targetCpuUtilization: number;
  volumeSize: number;
  volumeType: ec2.EbsDeviceVolumeType;
  encrypted: boolean;
  deleteOnTermination: boolean;
  iops: number;
  deviceName: string;
  requireImdsv2?: boolean;
  subnetType?: string;
  autoScalingGroupName?: string;
  cpuScalingPolicyName?: string;
  userDataScriptPath?: string;
}

/**
 * Application Tier Auto Scaling Group Construct for 3-Tier Architecture
 * 
 * Creates an Auto Scaling Group for application tier servers (business logic layer)
 * 
 * The Application Tier:
 * - Receives requests from the Web Tier
 * - Deploys instances across multiple availability zones in private subnets
 * - Handles business logic, application processing, and API services
 * - Communicates with the Database Tier for data operations
 * - Does NOT receive traffic directly from the ALB
 * - Automatically scales based on CPU utilization
 * - Maintains desired capacity and handles instance failures
 * - Enforces IMDSv2 for enhanced security
 * 
 * Key differences from Web Tier:
 * - Not attached to ALB target group (internal tier)
 * - Listens on app tier port (e.g., 8080)
 * - Only accepts traffic from Web Tier
 * - Has direct access to Database Tier
 */
export class AppTierAsgConstruct extends Construct {
  public readonly autoScalingGroup: autoscaling.AutoScalingGroup;

  constructor(scope: Construct, id: string, props: AppTierAsgConstructProps) {
    super(scope, id);

    // Determine subnet type
    const subnetType = props.subnetType === 'PUBLIC' 
      ? ec2.SubnetType.PUBLIC
      : props.subnetType === 'PRIVATE_ISOLATED'
      ? ec2.SubnetType.PRIVATE_ISOLATED
      : ec2.SubnetType.PRIVATE_WITH_EGRESS;

    // Create Application Tier Auto Scaling Group
    this.autoScalingGroup = new autoscaling.AutoScalingGroup(this, props.autoScalingGroupName || 'AppTierAutoScalingGroup', {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(props.instanceClass, props.instanceSize),
      machineImage: props.machineImage,
      securityGroup: props.securityGroup,
      minCapacity: props.minCapacity,
      maxCapacity: props.maxCapacity,
      desiredCapacity: props.desiredCapacity,
      vpcSubnets: { subnetType },
      cooldown: Duration.seconds(props.cooldown),
      requireImdsv2: props.requireImdsv2 ?? true,
      blockDevices: [
        {
          deviceName: props.deviceName,
          volume: autoscaling.BlockDeviceVolume.ebs(props.volumeSize, {
            volumeType: props.volumeType as autoscaling.EbsDeviceVolumeType,
            encrypted: props.encrypted,
            deleteOnTermination: props.deleteOnTermination,
            iops: props.iops,
          }),
        },
      ],
    });

    // User data to install and configure application server
    if (props.userDataScriptPath) {
      const userDataScript = fs.readFileSync(props.userDataScriptPath, 'utf8');
      this.autoScalingGroup.addUserData(userDataScript);
    }

    // NOTE: Application Tier does NOT attach to ALB target group
    // It receives traffic from Web Tier instances directly

    // Set health check configuration using CloudFormation override
    const cfnAsg = this.autoScalingGroup.node.defaultChild as autoscaling.CfnAutoScalingGroup;
    cfnAsg.healthCheckGracePeriod = props.healthCheckGracePeriod;
    cfnAsg.healthCheckType = props.healthCheckType;

    // Add CPU-based scaling policy
    this.autoScalingGroup.scaleOnCpuUtilization(props.cpuScalingPolicyName || 'AppTierCpuScaling', {
      targetUtilizationPercent: props.targetCpuUtilization,
      cooldown: Duration.seconds(props.cooldown),
    });
  }
}
