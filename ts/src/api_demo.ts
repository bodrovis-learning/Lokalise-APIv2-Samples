require("dotenv").config()

const { LokaliseApi } = require('@lokalise/node-api')
const fs = require('fs')
const path = require('path')
const AdmZip = require("adm-zip")
const got = require('got')

async function waitUntilUploadingDone(lokaliseApi, processId, projectId) {
  return await new Promise(resolve => {
    const interval = setInterval(async () => {
      const reloadedProcess = await lokaliseApi.queuedProcesses().get(processId, {
        project_id: projectId,
      })
  
      if (reloadedProcess.status === 'finished') {
        resolve(reloadedProcess.status)
        clearInterval(interval)
      }
    }, 1000)
  })
}


async function download(translationsUrl, archive) {
  try {
    const response = await got.get(translationsUrl).buffer()
    fs.writeFileSync(archive, response)
  } catch (error) {
    console.log(error)
  }
}


async function main() {
  const i18nFolder = path.resolve(__dirname, 'i18n')

  // INITIALIZE API CLIENT
  const lokaliseApi = new LokaliseApi({ apiKey: process.env.API_KEY })


  // CREATE PROJECT
  console.log("Creating project...")

  const project = await lokaliseApi.projects().create({
    name: "Node.js Sample Project",
    description: "Here's my Node.js project",
    languages: [
      {
          "lang_iso": "en"
      },
      {
          "lang_iso": "fr"
      }
    ],
    "base_lang_iso": "en"
  })

  const projectId = project.project_id
  console.log(projectId)
  console.log(project.name)


  // INVITE CONTRIBUTORS
  console.log("Inviting contributors...")

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
    { project_id: projectId }
  )

  console.log(contributors[0].email)
  console.log(contributors[0].user_id)


  // UPLOAD TRANSLATION FILE
  console.log("Uploading translations...")

  const i18nFile = path.join(i18nFolder, 'en.json')

  const data = fs.readFileSync(i18nFile, 'utf8')

  const buff = Buffer.from(data, 'utf8')

  const base64I18n = buff.toString('base64')

  const bgProcess = await lokaliseApi.files().upload(projectId, {
    data: base64I18n,
    filename: "en.json",
    lang_iso: "en",
  })

  console.log("Updating process status...")

  await waitUntilUploadingDone(lokaliseApi, bgProcess.process_id, projectId)

  console.log("Uploading is done!")


  // LIST TRANSLATION KEYS
  console.log("Getting created translation keys...")

  const keys = await lokaliseApi.keys().list({
    project_id: projectId
  })

  const keyIds = keys.items.map(function(currentValue) {
    return currentValue.key_id
  })

  console.log(keyIds)


  // ASSIGNING TASKS
  console.log("Assinging a translation task...")

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
    { project_id: projectId }
  )

  console.log(task.title)
  console.log(task.languages[0].language_iso)


  // DOWNLOAD TRANSLATIONS
  // console.log("Downloading translations...")
  // const projectId = ""

  // const downloadResponse = await lokaliseApi.files().download(projectId, {
  //   format: "json",
  //   original_filenames: true,
  //   directory_prefix: '',
  //   filter_langs: ['fr'],
  //   indentation: '2sp',
  // })
  
  // const translationsUrl = downloadResponse.bundle_url
  // const archive = path.resolve(i18nFolder, 'archive.zip')

  // await download(translationsUrl, archive)

  // // EXTRACT TRANSLATIONS FROM ARCHIVE

  // const zip = new AdmZip(archive)
  // zip.extractAllTo(i18nFolder, true)

  // fs.unlink(archive, (err) => {
  //   if (err) throw err
  // })
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })