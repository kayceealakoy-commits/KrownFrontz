"""Set image fields in main.js from assets/products/ (legacy entry point)."""

from sync_images import sync_products


def main() -> None:
    sync_products(dry_run=False)


if __name__ == "__main__":
    main()
