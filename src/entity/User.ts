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
// We will also need to import the LeaveApproval entity later

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

  // --- ADD THIS COLUMN FOR THE MANAGER ID ---
  @Column({ type: "int", nullable: true }) // nullable: true because not all users have a manager
  manager_id!: number | null; // TypeScript type reflects nullable column

  // --- ADD THIS FOR CREATED/UPDATED TIMESTAMPS ---
  // (Using TypeORM's @CreateDateColumn and @UpdateDateColumn is often cleaner)
  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at!: Date;

  @Column({
      type: "timestamp",
      default: () => "CURRENT_TIMESTAMP",
      onUpdate: "CURRENT_TIMESTAMP",
  })
  updated_at!: Date;
  // --- OR using TypeORM decorators ---
  // @CreateDateColumn()
  // createdAt!: Date;
  // @UpdateDateColumn()
  // updatedAt!: Date;
  // (Requires importing @CreateDateColumn and @UpdateDateColumn from typeorm)


  // Define the Many-to-One relationship with Role
  @ManyToOne(() => Role, (role) => role.users)
  @JoinColumn({ name: "role_id" })
  role!: Role;

  // Define the relationship to the user's manager
  // Many users report to One manager
  @ManyToOne(() => User, (manager) => manager.reports)
  @JoinColumn({ name: "manager_id" }) // Link this relationship to the manager_id column
  manager!: User | null; // TypeScript type: User entity or null

  // Define the relationship to the users who report to this manager
  // One manager can have Many reports
  @OneToMany(() => User, (user) => user.manager)
  reports!: User[]; // TypeScript type: Array of User entities

  // Define the One-to-Many relationship with Leave
  @OneToMany(() => Leave, (leave) => leave.user)
  leaves!: Leave[];

  // Define the One-to-Many relationship with LeaveBalance
  @OneToMany(() => LeaveBalance, (leaveBalance) => leaveBalance.user) // Corrected syntax here
  leaveBalances!: LeaveBalance[];
    leaveApprovalsTaken: any;

}