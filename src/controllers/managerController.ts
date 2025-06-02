import { Request, Response, NextFunction, RequestHandler } from "express";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import { Leave } from "../entity/Leave";
import { LeaveType } from "../entity/LeaveType";
import { LeaveStatus } from "../entity/Leave";

export interface AuthenticatedRequest extends Request {
  user?: {
    user_id: number;
    role_id: number;
  };
}

export class ManagerController {
  getPendingLeaveRequests: RequestHandler<any, any, any, any> = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated." });
      return;
    }

    const managerId = req.user.user_id;

    try {
      const userRepository = AppDataSource.getRepository(User);
      const leaveRepository = AppDataSource.getRepository(Leave);

      const reports = await userRepository.find({
        where: { manager_id: managerId },
        select: ["user_id"],
      });

      const reportUserIds = reports.map((report) => report.user_id);

      if (reportUserIds.length === 0) {
        res.status(200).json([]);
        return;
      }

      const pendingRequests = await leaveRepository
        .createQueryBuilder("leave")
        .where("leave.status = :status", { status: LeaveStatus.Pending })
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

      res.status(200).json(pendingRequests);
    } catch (error) {
      console.error("Error fetching pending leave requests:", error);
      next(error);
    }
  };
}
