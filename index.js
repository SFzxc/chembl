const Utils = require("./utils");

const playwright = require("playwright");
const baseSearchUrl =
  "https://www.ebi.ac.uk/chembl/g/#search_results/targets/query=";

async function main() {
  const browser = await playwright.chromium.launch({
    headless: false, // setting this to true will not run the UI
  });

  const keyword = "Aldose reductase";
  console.log(`Keyword: ${keyword}`);

  const page = await browser.newPage();

  const ids = await fetchIdsByKeyword(page, keyword);
  console.log(ids);
  console.log('Stop searching due to empty results. Please try to run again!');

  for await (const id of ids) {
    console.log(`Starting download id: ${id}`);
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await downloadFileById(page, id);
    await Utils.sleep(1000);
    console.log(`Finished download id: ${id}`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function downloadFileById(page, id) {
  url = `https://www.ebi.ac.uk/chembl/g/#browse/activities/filter/target_chembl_id:${id}`;
  await page.goto(url);
  await page.waitForSelector("div .BCK-MenuContainer");
  // Click CSV button
  const downloadBtn = await page.waitForSelector("[data-format=CSV]");
  await downloadBtn.click();
  await Utils.sleep(500);

  await page.waitForSelector(
    "div[data-hb-template=Handlebars-Common-DownloadLink] a"
  );
  await Utils.sleep(500);
  // Click "Click here" button
  let downloadLocator = page
    .locator("div[data-hb-template=Handlebars-Common-DownloadLink] a")
    .first();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    Utils.sleep(1000),
    downloadLocator.click(),
  ]);
  // wait for download to complete
  const path = await download.path();
  const filePath = `./data/${id}.zip`;
  // save into the desired path
  await download.saveAs(filePath);
  // wait for the download and delete the temporary file
  await download.delete();
  console.log(`Downloaded ${id} in ${filePath}`);

  await page.close();
}

async function fetchIdsByKeyword(page, keyword) {
  // encodeURIComponent to convert space character to %20
  const url = baseSearchUrl + encodeURIComponent(keyword.toLowerCase());
  console.log(`Url: ${url}`);

  await page.goto(url);
  await page.waitForTimeout(5000);

  await page.waitForSelector("#ESTarget tbody");

  const rows = await page.$eval("#ESTarget tbody", (tableBody) => {
    let all = [];
    for (let i = 0, row; (row = tableBody.rows[i]); i++) {
      let data = [];
      for (let j = 0, col; (col = row.cells[j]); j++) {
        data.push(row.cells[j].innerText);
      }
      all.push(data);
    }
    return all;
  });

  console.log("Filtering valid row......");
  const validRows = rows.filter(
    (row) => row[3].toLowerCase() === keyword.toLowerCase()
  );
  console.log("Selecting chembl ids.........");
  const ids = validRows.map((row) => {
    return row[1];
  });

  return ids;
}
