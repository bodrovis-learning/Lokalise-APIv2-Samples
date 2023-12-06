import "dotenv/config";

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { LokaliseApi } from "@lokalise/node-api";
import AdmZip from "adm-zip";

async function main() {
  const lokaliseApi = new LokaliseApi({ apiKey: process.env.API_KEY });

  console.log("Creating project...");

  const project = await lokaliseApi.projects().create({
    name: "Node.js Sample Project",
    description: "Here's my Node.js project",
    languages: [
      {
        lang_iso: "en",
      },
      {
        lang_iso: "fr",
      },
    ],
    base_lang_iso: "en",
  });

  const projectId = project.project_id;

  console.log(projectId);
  console.log(project.name);

  // // If needed, provide the project ID manually:
  // const projectId = "41927157619e6abd190863.11993227";

  console.log("Inviting contributors...");

  const contributors = await lokaliseApi.contributors().create(
    [
      {
        email: "translator@example.com",
        fullname: "Mr. Translator",
        is_admin: false,
        is_reviewer: true,
        languages: [
          {
            lang_iso: "en",
            is_writable: false,
          },
          {
            lang_iso: "fr",
            is_writable: true,
          },
        ],
      },
    ],
    { project_id: projectId },
  );

  console.log(contributors[0].email);
  console.log(contributors[0].user_id);

  console.log("Uploading translations...");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const i18nFolder = path.resolve(__dirname, "i18n");
  const i18nFile = path.join(i18nFolder, "en.json");
  const data = await fs.readFile(i18nFile, "utf8");
  const buff = Buffer.from(data, "utf8");
  const base64I18n = buff.toString("base64");

  const bgProcess = await lokaliseApi.files().upload(projectId, {
    data: base64I18n,
    filename: "en.json",
    lang_iso: "en",
  });

  console.log("Updating process status...");

  await waitUntilUploadingDone(lokaliseApi, bgProcess.process_id, projectId);

  console.log("Uploading is done!");

  console.log("Getting created translation keys...");

  const keys = await lokaliseApi.keys().list({
    project_id: projectId,
  });
  const keyIds = keys.items.map((currentValue) => currentValue.key_id);

  console.log(keyIds);

  console.log("Assinging a translation task...");

  const task = await lokaliseApi.tasks().create(
    {
      title: "Translate French",
      keys: keyIds, // use ids obtained on the previous step
      languages: [
        {
          language_iso: "fr",
          users: [contributors[0].user_id], // an array of task assignee, we add the previously invited user
        },
      ],
    },
    { project_id: projectId },
  );

  console.log(task.title);
  console.log(task.languages[0].language_iso);

  console.log("Downloading translations...");

  const downloadResponse = await lokaliseApi.files().download(projectId, {
    format: "json",
    original_filenames: true,
    directory_prefix: "",
    filter_langs: ["fr"],
    indentation: "2sp",
  });
  const translationsUrl = downloadResponse.bundle_url;
  const zip = new AdmZip(await zipBuffer(translationsUrl));
  zip.extractAllTo(i18nFolder, true);
}

async function zipBuffer(translationsUrl: string): Promise<Buffer> {
	const response = await fetch(translationsUrl);
	const arrayBuffer = await response.arrayBuffer();

	return Buffer.from(new Uint8Array(arrayBuffer));
}

async function waitUntilUploadingDone(
	lokaliseApi: LokaliseApi,
	processId: string,
	projectId: string,
): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const interval = setInterval(async () => {
			try {
				const reloadedProcess = await lokaliseApi
					.queuedProcesses()
					.get(processId, {
						project_id: projectId,
					});

				if (reloadedProcess.status === "finished") {
					clearInterval(interval);
					resolve(reloadedProcess.status);
				}
			} catch (error) {
				clearInterval(interval);
				console.error("An error occurred:", error);
				reject("error");
			}
		}, 1000);
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
