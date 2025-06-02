import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Leave } from "./Leave";
import { User } from "./User";

export enum ApprovalAction {
  Approved = "Approved",
  Rejected = "Rejected",
  Reviewed = "Reviewed",
  Pending = "Pending"
}

@Entity("leave_approvals")
export class LeaveApproval {
  @PrimaryGeneratedColumn({ type: "int" })
  approval_id!: number;

  @Column({ type: "int" })
  leave_id!: number;

  @Column({ type: "int" })
  approver_id!: number;

  @Column({
    type: "enum",
    enum: ApprovalAction,
    default: ApprovalAction.Reviewed,
  })
  action!: ApprovalAction;

  @Column({ type: "text", nullable: true })
  comments!: string | null;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  approved_at!: Date;

  @ManyToOne(() => Leave, (leave) => leave.approvals)
  @JoinColumn({ name: "leave_id" })
  leave!: Leave;

  @ManyToOne(() => User, (user) => user.leaveApprovalsTaken)
  @JoinColumn({ name: "approver_id" })
  approver!: User;
}
