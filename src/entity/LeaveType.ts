import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Leave } from "./Leave"; // Import related entities
import { LeaveBalance } from "./LeaveBalance";

@Entity("leave_types") // Maps this class to the 'leave_types' table
export class LeaveType {
  // Use 'export' keyword

  @PrimaryGeneratedColumn({ type: "int" })
    type_id!: number; // TypeScript type: number

  @Column({ type: "varchar", length: 50, unique: true })
    name!: string; // TypeScript type: string

  @Column({ type: "varchar", length: 255, nullable: true })
    description!: string | null; // TypeScript type: string or null

  @Column({ type: "boolean", default: true })
    requires_approval!: boolean; // TypeScript type: boolean

  @Column({ type: "boolean", default: true })
    is_balance_based!: boolean; // TypeScript type: boolean

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    created_at!: Date; // TypeScript type: Date

  // Define the One-to-Many relationship with Leave
  // The inverse side on the Leave entity is the 'leaveType' property
  @OneToMany(() => Leave, (leave) => leave.leaveType)
    leaves!: Leave[]; // TypeScript type: Array of Leave entities

  // Define the One-to-Many relationship with LeaveBalance
  // The inverse side on the LeaveBalance entity is the 'leaveType' property
  @OneToMany(() => LeaveBalance, (leaveBalance) => leaveBalance.leaveType)
    leaveBalances!: LeaveBalance[]; // TypeScript type: Array of LeaveBalance entities
}
