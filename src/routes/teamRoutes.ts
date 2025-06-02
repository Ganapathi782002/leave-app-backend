// src/routes/teamRoutes.ts
import express, { Request, Response, RequestHandler } from "express";
import protect, { AuthenticatedRequest } from "../middleware/authMiddleware";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import { LeaveBalance } from "../entity/LeaveBalance";
import { Leave, LeaveStatus } from "../entity/Leave";
import { Role } from "../entity/Role";
import { In } from "typeorm";
import { calculateWorkingDays } from "../utils/dateUtils"; // <--- NEW: Import your utility function

const router = express.Router();

// Define interfaces for the response data
interface TeamMemberLeaveBalance {
    user_id: number;
    name: string;
    email: string;
    role_id: number;
    role_name: string;
    balances: Array<{
        type_id: number;
        type_name: string;
        total_days: number;
        used_days: number;
        available_days: number;
    }>;
}

const MANAGER_ROLE_ID = 3;
const EMPLOYEE_ROLE_ID = 2;
const INTERN_ROLE_ID = 4;

// Removed the getWorkingDays helper function from here

const getMyTeamLeaveBalances: RequestHandler = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.user_id;
        const roleId = req.user?.role_id;

        if (!userId || roleId !== MANAGER_ROLE_ID) {
            res.status(403).json({ message: "Access denied. Only managers can view team balances." });
            return;
        }

        const userRepository = AppDataSource.getRepository(User);
        const leaveBalanceRepository = AppDataSource.getRepository(LeaveBalance);
        const leaveRepository = AppDataSource.getRepository(Leave);

        const reportingUsers = await userRepository.find({
            where: {
                manager_id: userId,
                role_id: In([EMPLOYEE_ROLE_ID, INTERN_ROLE_ID])
            },
            relations: ["role"],
            select: ["user_id", "name", "email", "role_id"],
        });

        const teamData: TeamMemberLeaveBalance[] = [];

        for (const member of reportingUsers) {
            let memberBalances: TeamMemberLeaveBalance['balances'] = [];

            if (member.role_id === EMPLOYEE_ROLE_ID) {
                const balances = await leaveBalanceRepository
                    .createQueryBuilder("balance")
                    .leftJoinAndSelect("balance.leaveType", "leaveType")
                    .where("balance.user_id = :userId", { userId: member.user_id })
                    .select([
                        "balance.type_id",
                        "balance.total_days",
                        "balance.used_days",
                        "leaveType.name",
                    ])
                    .getMany();

                memberBalances = balances.map((b) => ({
                    type_id: b.type_id,
                    type_name: b.leaveType?.name || "N/A",
                    total_days: parseFloat(b.total_days as any),
                    used_days: parseFloat(b.used_days as any),
                    available_days: parseFloat(b.total_days as any) - parseFloat(b.used_days as any),
                }));

            } else if (member.role_id === INTERN_ROLE_ID) {
                const approvedLeaves = await leaveRepository.find({
                    where: {
                        user_id: member.user_id,
                        status: LeaveStatus.Approved,
                    },
                    select: ["start_date", "end_date"],
                });

                const totalDaysTakenByIntern = approvedLeaves.reduce((sum, leave) => {
                    const startDate = new Date(leave.start_date);
                    const endDate = new Date(leave.end_date);
                    // <--- UPDATED: Use your imported calculateWorkingDays function
                    const workingDays = calculateWorkingDays(startDate, endDate);
                    return sum + workingDays;
                }, 0);

                memberBalances.push({
                    type_id: 999,
                    type_name: "Total Leave Taken",
                    total_days: 0,
                    used_days: totalDaysTakenByIntern,
                    available_days: 0,
                });
            }

            teamData.push({
                user_id: member.user_id,
                name: member.name,
                email: member.email,
                role_id: member.role_id,
                role_name: member.role?.name || "N/A",
                balances: memberBalances,
            });
        }

        res.status(200).json(teamData);
        return;

    } catch (error: any) {
        console.error("Error fetching my team balances:", error);
        res.status(500).json({ message: "Internal server error fetching team data." });
        return;
    }
};

router.get("/my-team-balances", protect, getMyTeamLeaveBalances);

export default router;