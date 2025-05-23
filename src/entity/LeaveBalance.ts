import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { LeaveType } from "./LeaveType";

@Entity("leave_balances") // Maps this class to the 'leave_balances' table
export class LeaveBalance {
  // Use 'export' keyword

  @PrimaryGeneratedColumn({ type: "int" })
    balance_id!: number; // TypeScript type: number

  @Column({ type: "int" }) // Foreign key column
    user_id!: number; // TypeScript type: number

  @Column({ type: "int" }) // Foreign key column
    type_id!: number; // TypeScript type: number

  @Column({ type: "int" })
    year!: number; // TypeScript type: number

  @Column({ type: "decimal", precision: 5, scale: 2 }) // Decimal with precision and scale
    total_days!: string; // TypeScript type: number (JavaScript represents decimals as numbers)

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0.0 })
    used_days!: string; // TypeScript type: number

  @Column({ type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  available_days!: string;

  // Define the Many-to-One relationship with User
  // The inverse side on the User entity is the 'leaveBalances' property
  @ManyToOne(() => User, (user) => user.leaveBalances)
    @JoinColumn({ name: "user_id" }) // Explicitly specify the foreign key column name
    user!: User; // TypeScript type: User entity

  // Define the Many-to-One relationship with LeaveType
  // The inverse side on the LeaveType entity is the 'leaveBalances' property
  @ManyToOne(() => LeaveType, (leaveType) => leaveType.leaveBalances)
    @JoinColumn({ name: "type_id" }) // Explicitly specify the foreign key column name
    leaveType!: LeaveType; // TypeScript type: LeaveType entity
}
