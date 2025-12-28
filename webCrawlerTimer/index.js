import spider from '../crawler.js';

export default async function (context, myTimer) {
    context.log('Timer triggered at', new Date().toISOString());
    await spider();
}
