import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Leave } from "./Leave";
import { LeaveBalance } from "./LeaveBalance";

@Entity("leave_types")
export class LeaveType {
  @PrimaryGeneratedColumn({ type: "int" })
  type_id!: number;

  @Column({ type: "varchar", length: 50, unique: true })
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description!: string | null;

  @Column({ type: "boolean", default: true })
  requires_approval!: boolean;

  @Column({ type: "boolean", default: true })
  is_balance_based!: boolean;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at!: Date;

  @OneToMany(() => Leave, (leave) => leave.leaveType)
  leaves!: Leave[];

  @OneToMany(() => LeaveBalance, (leaveBalance) => leaveBalance.leaveType)
  leaveBalances!: LeaveBalance[];
}
