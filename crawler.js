import 'dotenv/config'
import fs from 'fs'
import { load } from 'cheerio'
import db from './db/connection.js'

const urlsToVisit = new Set();
let currentVisitetAmount = 0

const delay = (delayInms) => {
    return new Promise(resolve => setTimeout(resolve, delayInms));
};

async function spider() {

    const request = await db.query(`SELECT * FROM pages_not_Found ORDER BY id LIMIT 100`)


    const searchTerms = request.rows
    console.log("seach quaries in database", searchTerms)

    for (const row of searchTerms) {
        const qury = row.qury
        const searchResponse = await fetch(
            process.env.GOOGLE_API + qury + "&num=2"
        )
        const searchData = await searchResponse.json()

        if (searchData.items) {
            for (const item of searchData.items) {
                urlsToVisit.add(item.link)
            }
        }
    }

    while (currentVisitetAmount < urlsArray.length) {

        const urlsArray = [...urlsToVisit];

        const currentUrl = urlsArray[currentVisitetAmount];

        await delay(1000);

        try {
            console.log("currently visting", currentUrl)
            const response = await fetch(currentUrl)
            const result = await response.text();

            fs.writeFileSync("index.html", result);
            const htmlPageString = fs.readFileSync("index.html").toString();

            const $ = load(htmlPageString)
            const title = $('head > title').text().trim() || 'Untitled';
            const language = $('html').attr('lang')?.startsWith('da') ? 'da' : 'en';
            const content =
                $('#mw-content-text').text().trim() ||
                $('body').text().trim();

            // find all links on the page
            const linkElements = $('a[href]');
            linkElements.each((index, element) => {
                let url = $(element).attr('href');

                if (!url.startsWith('http')) {
                    url = new URL(url, currentUrl).href;
                }

                if (url.startsWith(currentUrl) && !url.includes('#') && !url.endsWith(".jpg") && !urlsArray.includes(url)) {
                    urlsToVisit.add(url);
                }
            })

            await db.query(
                `INSERT INTO pages (title , url, language, last_updated, content)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (url) DO UPDATE SET
                    title = EXCLUDED.title,
                    language = EXCLUDED.language,
                    last_updated = EXCLUDED.last_updated,
                    content = EXCLUDED.content`,
                [title, currentUrl, language, new Date().toISOString(), content]
            )

        } catch (error) {
            console.error("Failed to crawl:", currentUrl, error)
        }

        console.log(urlsToVisit)

        currentVisitetAmount++
    };

}

spider();