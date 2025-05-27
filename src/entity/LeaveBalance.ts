import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { LeaveType } from "./LeaveType";

@Entity("leave_balances")
export class LeaveBalance {

  @PrimaryGeneratedColumn({ type: "int" })
    balance_id!: number;

  @Column({ type: "int" })
    user_id!: number;

  @Column({ type: "int" })
    type_id!: number;

  @Column({ type: "int" })
    year!: number;

  @Column({ type: "decimal", precision: 5, scale: 2 })
    total_days!: string;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0.0 })
    used_days!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  available_days!: string;

  @ManyToOne(() => User, (user) => user.leaveBalances)
    @JoinColumn({ name: "user_id" })
    user!: User;

  @ManyToOne(() => LeaveType, (leaveType) => leaveType.leaveBalances)
    @JoinColumn({ name: "type_id" })
    leaveType!: LeaveType;
}
