
const strapi = require('@strapi/strapi');

async function debugSession() {
    const app = await strapi().load();

    // ID from the user's screenshot
    const targetSessionId = 560;

    console.log(`--- DEBUGGING SESSION ${targetSessionId} ---`);

    try {
        const session = await app.entityService.findOne('api::mesa-sesion.mesa-sesion', targetSessionId, {
            populate: ['mesa', 'restaurante'],
        });

        if (!session) {
            console.log('❌ Session NOT FOUND in database.');
        } else {
            console.log('✅ Session FOUND:');
            console.log(JSON.stringify(session, null, 2));

            console.log('\n--- ANALYSIS ---');
            console.log(`Status: ${session.session_status}`);
            console.log(`Mesa Number (Direct): ${session.mesa ? session.mesa.number : 'N/A'}`);
            console.log(`Mesa ID: ${session.mesa ? session.mesa.id : 'N/A'}`);
        }
    } catch (error) {
        console.error('Error querying session:', error);
    }

    process.exit(0);
}

debugSession();
