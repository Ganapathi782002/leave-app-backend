import { Entity, Column, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User"; // Import related entity

@Entity("roles")
export class Role {
  // --- Change PrimaryColumn to PrimaryGeneratedColumn if using AUTO_INCREMENT in DB ---
  @PrimaryGeneratedColumn({ type: "int" }) // Use PrimaryGeneratedColumn for auto-incrementing PK
  role_id!: number;

  @Column({ type: "varchar", length: 50, unique: true })
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description!: string | null;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at!: Date;

  @OneToMany(() => User, (user) => user.role)
  users!: User[];
}
