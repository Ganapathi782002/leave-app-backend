// src/database/seeds/001_create_roles_seeder.ts
import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import { Role } from '../../entity/Role'; // Adjust path based on your structure

export default class CreateRolesSeeder implements Seeder {

    public async run(dataSource: DataSource): Promise<any> {
        const roleRepository = dataSource.getRepository(Role);

        const roles = [
            { role_id: 1, name: 'Admin' },
            { role_id: 2, name: 'Employee' },
            { role_id: 3, name: 'Manager' },
            { role_id: 4, name: 'Intern' },
        ];

        // Check if roles already exist before inserting
        // Using save allows updating if role_id exists, or inserting if new.
        // Be careful with this if role_id is auto-generated.
        // If role_id is NOT auto-generated and you define them explicitly, save is fine.
        // If role_id IS auto-generated, you might prefer findOne then create/save,
        // or use insert ignoring duplicates if your DB supports it.
        // Assuming role_id is NOT auto-generated for explicit control here.
        const existingRoles = await roleRepository.find();
        const rolesToSave = roles.filter(role =>
            !existingRoles.some(existing => existing.role_id === role.role_id)
        );

        if (rolesToSave.length > 0) {
            await roleRepository.save(rolesToSave);
            console.log('Roles seeded successfully.');
        } else {
            console.log('Roles already exist, skipping seeding.');
        }
    }
}