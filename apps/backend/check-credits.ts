import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCredits() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        credits: true,
      },
    });

    console.log('Current user credits:');
    console.table(users);

    const usersWithLowCredits = users.filter(u => u.credits < 100);
    if (usersWithLowCredits.length > 0) {
      console.log(`\nFound ${usersWithLowCredits.length} users with less than 100 credits.`);
    } else {
      console.log('\n✅ All users have at least 100 credits!');
    }
  } catch (error) {
    console.error('Error checking credits:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCredits();
