import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Role } from "./Role";
import { Leave } from "./Leave";
import { LeaveBalance } from "./LeaveBalance";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn({ type: "int" })
  user_id!: number;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  password_hash!: string;

  @Column({ type: "int" })
  role_id!: number;

  @Column({ type: "int", nullable: true })
  manager_id!: number | null;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at!: Date;

  @Column({
      type: "timestamp",
      default: () => "CURRENT_TIMESTAMP",
      onUpdate: "CURRENT_TIMESTAMP",
  })
  updated_at!: Date;


  @ManyToOne(() => Role, (role) => role.users)
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @ManyToOne(() => User, (manager) => manager.reports)
  @JoinColumn({ name: "manager_id" })
  manager!: User | null;

  @OneToMany(() => User, (user) => user.manager)
  reports!: User[];

  @OneToMany(() => Leave, (leave) => leave.user)
  leaves!: Leave[];

  @OneToMany(() => LeaveBalance, (leaveBalance) => leaveBalance.user)
  leaveBalances!: LeaveBalance[];
    leaveApprovalsTaken: any;

}