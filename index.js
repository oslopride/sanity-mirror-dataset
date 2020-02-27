const sanityClient = require("@sanity/client");
const exportDataset = require("@sanity/export");
const sanityImport = require("@sanity/import");
const core = require("@actions/core");
const path = require("path");
const fs = require("fs");

const datasetToReset = core.getInput("dataset_to_reset");
const datasetToMirror = core.getInput("dataset_to_mirror");
const sanityToken = core.getInput("sanity_token");
const sanityProjectId = core.getInput("sanity_project_id");

const NON_SYSTEM_DOCUMENTS_QUERY = `*[ !(_type match "system*")]`;

const client = sanityClient({
	projectId: sanityProjectId,
	token: sanityToken,
	useCdn: false,
	dataset: datasetToReset,
});

async function main() {
  const allDatasets = await client.datasets.list();

  if (!allDatasets.some(dataset => dataset.name === datasetToReset)) {
		throw new Error(`Dataset '${datasetToReset}' does not exist.`);
	}

  if (!allDatasets.some(dataset => dataset.name === datasetToMirror)) {
		throw new Error(`Dataset '${datasetToMirror}' does not exist.`);
	}

  const numberOfNonSystemDocuments = await client.fetch(
		`count(${NON_SYSTEM_DOCUMENTS_QUERY})`
	);

  if (numberOfNonSystemDocuments > 0) {
		core.debug(
			`Found ${numberOfNonSystemDocuments} existing documents within '${datasetToReset}'. Removing them...`
		);
	}

  let remainingDocuemntsToDelete = numberOfNonSystemDocuments;

  while (remainingDocuemntsToDelete > 0) {
    // From the sanity documentation:
    //    For the time being you should not delete more than ~1000 documents in
    //    one transaction. This will change in the future.
    // Ref: https://www.sanity.io/docs/http-mutations#deleting-multiple-documents-by-query-d8ebd1878516
    const { results } = await client.mutate([
			{ delete: { query: `*[ !(_type match "system*")][0..499]` } }
		]);

    remainingDocuemntsToDelete = await client.fetch(
			`count(${NON_SYSTEM_DOCUMENTS_QUERY})`
		);

    core.debug(
			`Removed ${results.length} documents, ${remainingDocuemntsToDelete} remaining.`
		);
  }

  core.debug(`Exporting '${datasetToMirror}' dataset...`);

  const outputPath = path.join(__dirname, "exported.tar.gz");

  await exportDataset({
		client,
		outputPath,
		dataset: datasetToMirror,
		raw: true,
		drafts: false,
		assetConcurrency: 12
  });
  
  core.debug(`Importing '${datasetToMirror}' into '${dataset}'...`);

  const exportedDataset = fs.createReadStream(outputPath);

	const { numDocs, warnings } = await sanityImport(exportedDataset, {
		client,
		operation: "createOrReplace"
	});

	fs.unlinkSync(outputPath);

	warnings.forEach(warning => core.debug(`Warning: ${warning}`));

  core.debug(`Imported ${numDocs} docuemnts.`);
  
  core.setOutput(
    "result",
    `Removed ${numberOfNonSystemDocuments} from '${datasetToReset}', and imported ${numDocs} docuemnts from '${datasetToMirror}' into '${datasetToReset}'`
  );
}

main()
  .then(result => core.setOutput("result", result))
  .catch(error => core.setFailed(error.message));
