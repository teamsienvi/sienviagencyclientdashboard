import pg from 'pg';

const { Client } = pg;

// Try multiple connection options
const configs = [
    {
        name: 'Pooler transaction mode (6543)',
        host: 'aws-0-ap-southeast-1.pooler.supabase.com',
        port: 6543,
        user: 'postgres.mhuxrnxajtiwxauhlhlv',
        password: 'pifdQYFeNaT27Vjp',
    },
    {
        name: 'Pooler session mode (5432)',
        host: 'aws-0-ap-southeast-1.pooler.supabase.com',
        port: 5432,
        user: 'postgres.mhuxrnxajtiwxauhlhlv',
        password: 'pifdQYFeNaT27Vjp',
    },
    {
        name: 'Direct IPv4 (pooler IP)',
        host: '54.255.219.82',
        port: 5432,
        user: 'postgres.mhuxrnxajtiwxauhlhlv',
        password: 'pifdQYFeNaT27Vjp',
    },
    {
        name: 'Direct IPv4 port 6543',
        host: '54.255.219.82',
        port: 6543,
        user: 'postgres.mhuxrnxajtiwxauhlhlv',
        password: 'pifdQYFeNaT27Vjp',
    },
];

async function tryConnect(config) {
    const client = new Client({
        host: config.host,
        port: config.port,
        database: 'postgres',
        user: config.user,
        password: config.password,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
    });

    try {
        await client.connect();
        const res = await client.query('SELECT 1 as test');
        console.log(`  ✓ ${config.name}: Connected! Test query: ${JSON.stringify(res.rows)}`);
        await client.end();
        return true;
    } catch (err) {
        console.log(`  ✗ ${config.name}: ${err.message}`);
        try { await client.end(); } catch (e) { }
        return false;
    }
}

async function main() {
    console.log('Testing Supabase database connections...\n');

    for (const config of configs) {
        const success = await tryConnect(config);
        if (success) {
            console.log(`\nUse this connection: ${config.name}`);
            console.log(`  Host: ${config.host}`);
            console.log(`  Port: ${config.port}`);
            console.log(`  User: ${config.user}`);
            break;
        }
    }
}

main();
