# frozen_string_literal: true

require 'dotenv/load'
require 'lokalise_manager'
require 'ruby-lokalise-api'

# GLOBAL OPTS
LokaliseManager::GlobalConfig.config do |c|
  c.api_token = ENV['API_KEY']
  c.locales_path = "#{Dir.getwd}/src/i18n"
end


# CREATING CLIENT
@client = Lokalise.client ENV['API_KEY']


# CREATING PROJECT
puts 'Creating project...'

project = @client.create_project name: 'Ruby Sample Project',
                                 description: 'My Ruby project',
                                 languages: [
                                   {
                                     lang_iso: 'en'
                                   },
                                   {
                                     lang_iso: 'fr'
                                   }
                                 ],
                                 base_lang_iso: 'en'

project_id = project.project_id

puts project_id
puts project.name
puts project.description


# INVITE CONTRIBUTORS
puts 'Inviting contributors...'

contributors = @client.create_contributors project_id,
                                           email: 'sample_ms_translator@example.com',
                                           fullname: 'Ms. Translator',
                                           languages: [
                                             {
                                               lang_iso: 'en',
                                               is_writable: false
                                             },
                                             {
                                               lang_iso: 'fr',
                                               is_writable: true
                                             }
                                           ]

contributor = contributors.collection.first

puts contributor.fullname
puts contributor.user_id


# UPLOADING TRANSLATIONS
puts 'Uploading translations...'

exporter = LokaliseManager.exporter project_id: project_id

processes = exporter.export!

def uploaded?(process)
  5.times do # try to check the status 5 times
    process = process.reload_data # load new data
    return(true) if process.status == 'finished' # return true is the upload has finished

    sleep 1 # wait for 1 second, adjust this number with regards to the upload size
  end

  false # if all 5 checks failed, return false (probably something is wrong)
end

uploaded? processes.first


# LIST TRANSLATION KEYS
puts 'Getting translation keys...'

key_ids = @client.keys(project_id).collection.map(&:key_id)

puts key_ids


# ASSIGNING TRANSLATION TASk
puts 'Assigning translation task...'

task = @client.create_task project_id,
                           title: 'Translate French',
                           keys: key_ids,
                           languages: [
                             {
                               language_iso: 'fr',
                               users: [contributor.user_id]
                             }
                           ]

puts task.title


# DOWNLOADING TRANSLATIONS
puts 'Downloading translations...'

importer = LokaliseManager.importer project_id: '5812150561782cfc34d058.67319047',
                                    import_opts: { filter_langs: ['fr'] }

importer.import!
