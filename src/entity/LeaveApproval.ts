import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Leave } from "./Leave";
import { User } from "./User"; 

// Define the possible actions for an approval record
export enum ApprovalAction {
    Approved = "Approved",
    Rejected = "Rejected",
    Reviewed = "Reviewed",
}

@Entity("leave_approvals") // Maps this class to the 'leave_approvals' table
export class LeaveApproval {
    @PrimaryGeneratedColumn({ type: "int" })
    approval_id!: number; // Unique ID for each approval record

    @Column({ type: "int" }) // Foreign key column for the leave request
    leave_id!: number;

    @Column({ type: "int" }) // Foreign key column for the user who took the action (the approver)
    approver_id!: number;

    @Column({ type: "enum", enum: ApprovalAction, default: ApprovalAction.Reviewed }) // Action taken (Approved, Rejected, etc.)
    action!: ApprovalAction; // TypeScript type: ApprovalAction Enum value

    @Column({ type: "text", nullable: true }) // Optional comments from the approver
    comments!: string | null; // TypeScript type: string or null

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    approved_at!: Date; // Timestamp when the action was taken

    // Define the Many-to-One relationship with Leave
    // An approval record belongs to one Leave request
    @ManyToOne(() => Leave, (leave) => leave.approvals) // 'approvals' is the inverse side property in Leave entity
    @JoinColumn({ name: "leave_id" }) // Explicitly specify the foreign key column name
    leave!: Leave; // TypeScript type: Leave entity

    // Define the Many-to-One relationship with User (the approver)
    // An approval record is associated with one User (the approver)
    @ManyToOne(() => User, (user) => user.leaveApprovalsTaken) // You might want a property on User to see approvals they've done
    @JoinColumn({ name: "approver_id" }) // Explicitly specify the foreign key column name
    approver!: User; // TypeScript type: User entity
}