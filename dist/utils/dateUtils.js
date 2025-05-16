"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateWorkingDays = void 0;
const calculateWorkingDays = (startDate, endDate) => {
    let count = 0;
    const currentDate = new Date(startDate.getTime()); // Create a mutable copy // Loop through each day from start_date to end_date
    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday // Check if the current day is NOT a Saturday (6) and NOT a Sunday (0)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++; // It's a working day
        } // Move to the next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
};
exports.calculateWorkingDays = calculateWorkingDays;
