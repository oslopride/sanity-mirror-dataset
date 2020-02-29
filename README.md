# sanity-mirror-dataset

Resets a sanity dataset to mirror another dataset.

**Be aware that this action will permanently remove all existing documents within the dataset you want to reset**

## Inputs

There are four inputs, all of which are required:

* **dataset_to_reset**: the dataset you want reset
* **dataset_to_mirror**: the dataset to mirror
* **sanity_project_id**: your sanity project id
* **sanity_token**: your sanity token (needs write access). This should be given through a secret.

## Example

To reset a dataset every night, put this in a workflow yml-file:

```
name: Nightly

on:
  schedule:
    - cron:  '0 23 * * *'

jobs:
  reset-sanity-dataset:
    runs-on: ubuntu-latest
    steps:
      - uses: oslopride/sanity-mirror-dataset@v0.1.2
        with:
          dataset_to_reset: developement
          dataset_to_mirror: production
          sanity_project_id: 123abc
          sanity_token: ${{ secrets.SANITY_TOKEN }}
```