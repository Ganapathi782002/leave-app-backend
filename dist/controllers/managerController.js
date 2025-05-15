"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagerController = void 0;
const data_source_1 = require("../data-source");
const User_1 = require("../entity/User");
const Leave_1 = require("../entity/Leave");
const Leave_2 = require("../entity/Leave");
class ManagerController {
    /**
     * Fetches pending leave requests for the authenticated manager's direct reports.
     */
    // Use RequestHandler and explicitly type the async function's return
    getPendingLeaveRequests = async (req, res, next) => {
        // Check if user info is available from auth middleware
        if (!req.user) {
            // Although authorizeRole should prevent this, it's good defensive programming
            res.status(401).json({ message: "User not authenticated." });
            return; // <-- Explicitly return void after sending response
        }
        const managerId = req.user.user_id;
        try {
            const userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
            const leaveRepository = data_source_1.AppDataSource.getRepository(Leave_1.Leave);
            // 1. Find the user IDs of the manager's direct reports
            const reports = await userRepository
                .find({
                where: { manager_id: managerId },
                select: ["user_id"],
            });
            const reportUserIds = reports.map(report => report.user_id);
            // If the manager has no reports, there are no requests to show
            if (reportUserIds.length === 0) {
                res.status(200).json([]); // Return empty array
                return; // <-- Explicitly return void after sending response
            }
            // 2. Fetch pending leave requests for these reports
            const pendingRequests = await leaveRepository
                .createQueryBuilder("leave")
                .where("leave.status = :status", { status: Leave_2.LeaveStatus.Pending })
                .andWhere("leave.user_id IN (:...userIds)", { userIds: reportUserIds })
                .leftJoinAndSelect("leave.user", "user")
                .leftJoinAndSelect("leave.leaveType", "leaveType")
                .select([
                "leave.leave_id",
                "leave.start_date",
                "leave.end_date",
                "leave.reason",
                "leave.status",
                "leave.applied_at",
                "user.user_id",
                "user.name",
                "leaveType.type_id",
                "leaveType.name",
            ])
                .orderBy("leave.applied_at", "ASC")
                .getMany();
            // TODO: Calculate working days for each request here before sending response?
            // Add the working_days_count to each request object in the pendingRequests array
            res.status(200).json(pendingRequests);
            // <-- No return needed here, implicitly returns Promise<void> after res.json()
        }
        catch (error) {
            console.error("Error fetching pending leave requests:", error);
            // Pass the error to the Express error handling middleware
            next(error); // Important: Call next with the error
            // <-- No return needed here after calling next(error), implicitly returns Promise<void>
        }
    };
}
exports.ManagerController = ManagerController;
