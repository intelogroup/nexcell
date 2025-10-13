import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateCredits() {
  try {
    // Update all users with less than 100 credits to 100
    const result = await prisma.user.updateMany({
      where: {
        credits: {
          lt: 100,
        },
      },
      data: {
        credits: 100,
      },
    });

    console.log(`✅ Updated ${result.count} user(s) to have 100 credits.`);

    // Verify the update
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        credits: true,
      },
    });

    console.log('\nUpdated user credits:');
    console.table(users);
  } catch (error) {
    console.error('Error updating credits:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCredits();
