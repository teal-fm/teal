import json
import os
import sys

def update_metadata():
    # Get CF_PAGES_URL from environment
    cf_pages_url = os.environ.get('CF_PAGES_URL')

    if not cf_pages_url:
        print("CF_PAGES_URL environment variable not found")
        sys.exit(1)

    # Remove 'https://' if present
    if cf_pages_url.startswith('https://'):
        cf_pages_url = cf_pages_url[8:]

    if os.environ.get('CF_PAGES_BRANCH') == 'main':
        # trim pages url if we are building for prod
        # TODO: remove this once we have a non-pages-dev url
        cf_pages_url.split('.')[1:]

    # Path to metadata file
    metadata_path_pre = 'assets/client-metadata.json'
    metadata_path = 'dist/client-metadata.json'

    try:
        # Read the JSON file
        with open(metadata_path_pre, 'r') as file:
            metadata = json.load(file)

        # Replace all instances of 'alpha.teal.fm' with CF_PAGES_URL
        metadata_str = json.dumps(metadata)
        updated_metadata_str = metadata_str.replace('alpha.teal.fm', cf_pages_url)
        updated_metadata = json.loads(updated_metadata_str)

        # Write the updated JSON back to file
        with open(metadata_path, 'w') as file:
            json.dump(updated_metadata, file, indent=2)

        print(f"Successfully updated {metadata_path} with {cf_pages_url}")

    except FileNotFoundError:
        print(f"Error: {metadata_path} not found")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in {metadata_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    update_metadata()
