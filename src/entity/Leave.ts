import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany, // <-- Import OneToMany
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { LeaveType } from "./LeaveType";
import { LeaveApproval } from "./LeaveApproval";

// Define the possible values for the status ENUM
export enum LeaveStatus {
  Pending = "Pending",
  Approved = "Approved",
  Rejected = "Rejected",
  Cancelled = "Cancelled",
  Awaiting_Admin_Approval = 'Awaiting_Admin_Approval',
}

@Entity("leaves")
export class Leave {
  @PrimaryGeneratedColumn({ type: "int" })
  leave_id!: number;

  @Column({ type: "int" })
  user_id!: number;

  @Column({ type: "int" })
  type_id!: number;

  @Column({ type: "date" })
  start_date!: Date;

  @Column({ type: "date" })
  end_date!: Date;

  @Column({ type: "text" })
  reason!: string;

  @Column({ type: "enum", enum: LeaveStatus, default: LeaveStatus.Pending })
  status!: LeaveStatus;

  @Column({ type: "int", default: 1 })
  required_approvals!: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  applied_at!: Date;

  @Column({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updated_at!: Date; // Define the Many-to-One relationship with User

  @Column({ nullable: true }) // processed_by_id can be null initially (when status is Pending)
  processed_by_id!: number | null; // ID of the user who last processed this request

  @Column({ type: "timestamp", nullable: true }) // processed_at can be null initially
  processed_at!: Date | null; // Timestamp when the request was last processed

  @ManyToOne(() => User, (user) => user.leaves)
  @JoinColumn({ name: "user_id" })
  user!: User; // Define the Many-to-One relationship with LeaveType

  @ManyToOne(() => LeaveType, (leaveType) => leaveType.leaves)
  @JoinColumn({ name: "type_id" })
  leaveType!: LeaveType;// A Leave request can have many approval records // The inverse side on the LeaveApproval entity is the 'leave' property

  @ManyToOne(() => User, { createForeignKeyConstraints: false }) // Adjust options based on your DB constraints
  @JoinColumn({ name: "processed_by_id" })
  processedBy!: User;

  @OneToMany(() => LeaveApproval, (leaveApproval) => leaveApproval.leave)
  approvals!: LeaveApproval[]; // Property name for the list of approval records
}
