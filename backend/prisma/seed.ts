import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { subDays, format } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ORUS database...');

  // User
  const user = await prisma.user.upsert({
    where: { email: 'admin@orus.dev' },
    update: {},
    create: {
      name: 'Admin ORUS',
      email: 'admin@orus.dev',
      passwordHash: await bcrypt.hash('admin123', 12),
    },
  });

  // Profile
  const profile = await prisma.profile.upsert({
    where: { userId_slug: { userId: user.id, slug: 'rainha-do-slot' } },
    update: {},
    create: {
      userId: user.id,
      name: 'Rainha do Slot',
      slug: 'rainha-do-slot',
      timezone: 'America/Sao_Paulo',
      currency: 'BRL',
    },
  });

  // Integration
  const integration = await prisma.integration.upsert({
    where: { id: 'seed-integration-1' },
    update: {},
    create: {
      id: 'seed-integration-1',
      profileId: profile.id,
      type: 'META_BMS',
      label: 'Meta BMS Principal',
      accountId: '123456789',
      isActive: true,
    },
  });

  // Campaigns
  const campaignNames = [
    'RST - Slot Machine - LAL 1% BR',
    'RST - Casino VIP - Interesses Gaming',
    'RST - Remarketing - Visitantes 7d',
  ];

  for (const name of campaignNames) {
    const externalId = `ext_${Math.random().toString(36).slice(2)}`;
    const campaign = await prisma.campaign.upsert({
      where: { integrationId_externalId: { integrationId: integration.id, externalId } },
      update: {},
      create: {
        profileId: profile.id,
        integrationId: integration.id,
        externalId,
        name,
        platform: 'META',
        dailyBudget: Math.random() * 500 + 200,
      },
    });

    // Metrics for last 30 days
    for (let d = 29; d >= 0; d--) {
      const date = subDays(new Date(), d);
      const spend = Math.random() * 300 + 100;
      const purchases = Math.floor(Math.random() * 15 + 3);
      const revenue = purchases * (Math.random() * 150 + 80);

      await prisma.campaignMetric.upsert({
        where: { campaignId_date: { campaignId: campaign.id, date } },
        update: {},
        create: {
          campaignId: campaign.id,
          date,
          impressions: Math.floor(Math.random() * 50000 + 10000),
          clicks: Math.floor(Math.random() * 2000 + 500),
          spend,
          revenue,
          purchases,
          leads: Math.floor(purchases * 1.5 + Math.random() * 10),
          ctr: Math.random() * 3 + 0.5,
          cpm: Math.random() * 20 + 10,
          roas: revenue / spend,
          cpa: spend / purchases,
        },
      });
    }
  }

  // Tracking Key
  const trackingKey = await prisma.trackingKey.upsert({
    where: { key: 'seed-tracking-key-demo' },
    update: {},
    create: {
      profileId: profile.id,
      key: 'seed-tracking-key-demo',
      label: 'Site Principal',
      isActive: true,
    },
  });

  // Site Conversions
  for (let d = 29; d >= 0; d--) {
    const date = subDays(new Date(), d);
    const leadsCount = Math.floor(Math.random() * 20 + 5);
    const purchasesCount = Math.floor(leadsCount * 0.3);

    for (let i = 0; i < leadsCount; i++) {
      await prisma.siteConversion.create({
        data: {
          profileId: profile.id,
          trackingKeyId: trackingKey.id,
          type: 'LEAD',
          utmCampaign: campaignNames[Math.floor(Math.random() * campaignNames.length)],
          utmSource: 'facebook',
          utmMedium: 'paid',
          siteCampaignId: 'camp-123',
          siteCampaignName: 'Slot Bônus',
          fingerprint: `fp_${Math.random().toString(36).slice(2)}`,
          createdAt: new Date(date.getTime() + Math.random() * 86400000),
        },
      });
    }

    for (let i = 0; i < purchasesCount; i++) {
      await prisma.siteConversion.create({
        data: {
          profileId: profile.id,
          trackingKeyId: trackingKey.id,
          type: 'PURCHASE',
          value: Math.random() * 200 + 50,
          utmCampaign: campaignNames[Math.floor(Math.random() * campaignNames.length)],
          utmSource: 'facebook',
          fingerprint: `fp_${Math.random().toString(36).slice(2)}`,
          createdAt: new Date(date.getTime() + Math.random() * 86400000),
        },
      });
    }
  }

  console.log(`✅ Seed completo!`);
  console.log(`   👤 User: admin@orus.dev / admin123`);
  console.log(`   📁 Profile: Rainha do Slot`);
  console.log(`   📊 3 campanhas + 30 dias de métricas`);
  console.log(`   🔑 Tracking Key: seed-tracking-key-demo`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
