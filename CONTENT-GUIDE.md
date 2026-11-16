# Content Guide — How to Update Your Healthy Snack Website

This guide shows you how to add, edit, or remove snack items using GitHub's web interface. No coding tools needed — just a browser.

---

## 1. Change the WhatsApp Number or Site Name

1. Go to your repository on github.com
2. Click on `data/config.json`
3. Click the pencil icon (Edit this file)
4. Change the values:
   - `whatsappNumber` — your full number with country code, no spaces or dashes (e.g., `919876543210`)
   - `siteName` — the name shown in the header
   - `tagline` — the subtitle under the name
   - `currency` — the symbol shown before prices (e.g., `₹`, `$`, `€`)
5. Click **Commit changes**

---

## 2. Add a New Snack Item

### Step A — Upload Images

1. Go to your repository on github.com
2. Navigate to the `images/` folder
3. Click **Add file → Create new file**
4. Type `your-item-name/placeholder` in the filename field (this creates the folder)
5. Click **Commit new file**
6. Navigate into your new `images/your-item-name/` folder
7. Click **Add file → Upload files**
8. Drag and drop your photos (name them `1.jpg`, `2.jpg`, etc.)
9. Click **Commit changes**

### Step B — Add Item to JSON

1. Click on `data/items.json`
2. Click the pencil icon
3. Add a new item block inside the `[ ]` array. Copy this template:

```json
{
  "id": "your-item-name",
  "name": "Your Item Display Name",
  "description": "A short description of the snack item.",
  "price": 100,
  "category": "Category",
  "images": [
    "images/your-item-name/1.jpg",
    "images/your-item-name/2.jpg"
  ],
  "ingredients": ["Ingredient 1", "Ingredient 2", "Ingredient 3"],
  "quantity": "Pack of 6 (50g each)",
  "calories": "150 kcal per piece",
  "allergyInfo": ["Contains nuts", "Gluten-free"],
  "available": true
}
```

4. Make sure to add a comma `,` after the previous item's closing `}`
5. Click **Commit changes**

**Important:** The `id` should be lowercase with hyphens (e.g., `oat-cookies`). Image paths must match the folder and filenames you uploaded.

### Field descriptions

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique lowercase ID with hyphens (e.g., `oat-cookies`) |
| `name` | Yes | Display name of the item |
| `description` | Yes | Description shown on the card and detail view |
| `price` | Yes | Price as a number (no currency symbol) |
| `category` | Yes | Category for filter pills (e.g., `Bars`, `Bites`, `Chips`) |
| `images` | Yes | Array of image paths relative to root |
| `ingredients` | No | Array of ingredient names (shown in detail view) |
| `quantity` | No | Pack size / quantity info (shown in detail view) |
| `calories` | No | Calorie information (shown in detail view) |
| `allergyInfo` | No | Array of allergy warnings (shown in detail view) |
| `available` | Yes | `true` or `false` — false greys out the item |

---

## 3. Edit an Existing Item

1. Click on `data/items.json`
2. Click the pencil icon
3. Find the item you want to change
4. Edit the `name`, `description`, `price`, `category`, or `images` array
5. Click **Commit changes**

---

## 4. Add More Photos to an Item

1. Navigate to `images/your-item-name/` in the repository
2. Click **Add file → Upload files**
3. Upload new photos (name them `3.jpg`, `4.jpg`, etc.)
4. Click **Commit changes**
5. Then edit `data/items.json` and add the new image paths to that item's `images` array

---

## 5. Mark an Item as Unavailable

1. Edit `data/items.json`
2. Find the item and change `"available": true` to `"available": false`
3. The item will appear greyed out with no order button

---

## 6. Remove an Item

1. Edit `data/items.json`
2. Delete the entire item block (from `{` to `}`) including the comma before or after it
3. Optionally delete its image folder from `images/`

---

## Tips

- **Image size:** Use JPEG or PNG images. For best results, crop to a 3:2 aspect ratio (e.g., 600×400 pixels)
- **JSON format:** Be careful with commas. Every item except the last one needs a comma after its `}`
- **Preview changes:** After committing, wait 1–2 minutes for GitHub Pages to rebuild, then refresh your site
- **Categories:** Use consistent category names across items. They auto-generate the filter buttons
