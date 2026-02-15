import { useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Edit2, Trash2, Plus, FolderOpen } from 'lucide-react'
import { Category, MainCategory } from '@/lib/db'

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}

interface CategoryManagerProps {
  categories: CategoryWithMain[]
  mainCategories: MainCategory[]
  onRefresh: () => void
}

export function CategoryManager({ categories, mainCategories, onRefresh }: CategoryManagerProps) {
  const [showMainCategoryDialog, setShowMainCategoryDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingMainCategory, setEditingMainCategory] = useState<MainCategory | null>(null)
  const [editingCategory, setEditingCategory] = useState<CategoryWithMain | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [mainCategoryForm, setMainCategoryForm] = useState({
    titel: '',
    reihenfolge: ''
  })

  const [categoryForm, setCategoryForm] = useState({
    titel: '',
    hauptkategorieId: '',
    reihenfolge: ''
  })

  const handleCreateMainCategory = async () => {
    if (!mainCategoryForm.titel) {
      alert('Bitte geben Sie einen Titel ein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/main-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titel: mainCategoryForm.titel,
          reihenfolge: mainCategoryForm.reihenfolge ? parseInt(mainCategoryForm.reihenfolge) : undefined
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowMainCategoryDialog(false)
        setMainCategoryForm({ titel: '', reihenfolge: '' })
        onRefresh()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to create main category:', error)
      alert('Fehler beim Erstellen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateMainCategory = async () => {
    if (!editingMainCategory || !mainCategoryForm.titel) {
      alert('Bitte geben Sie einen Titel ein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/main-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingMainCategory.id,
          titel: mainCategoryForm.titel,
          reihenfolge: mainCategoryForm.reihenfolge ? parseInt(mainCategoryForm.reihenfolge) : undefined
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowMainCategoryDialog(false)
        setEditingMainCategory(null)
        setMainCategoryForm({ titel: '', reihenfolge: '' })
        onRefresh()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to update main category:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteMainCategory = async (id: string) => {
    if (!confirm('Möchten Sie diese Hauptkategorie wirklich löschen?')) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/main-categories?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        onRefresh()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to delete main category:', error)
      alert('Fehler beim Löschen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!categoryForm.titel || !categoryForm.hauptkategorieId) {
      alert('Bitte füllen Sie alle Pflichtfelder aus')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titel: categoryForm.titel,
          hauptkategorieId: categoryForm.hauptkategorieId,
          reihenfolge: categoryForm.reihenfolge ? parseInt(categoryForm.reihenfolge) : undefined
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowCategoryDialog(false)
        setCategoryForm({ titel: '', hauptkategorieId: '', reihenfolge: '' })
        onRefresh()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to create category:', error)
      alert('Fehler beim Erstellen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateCategory = async () => {
    if (!editingCategory || !categoryForm.titel) {
      alert('Bitte geben Sie einen Titel ein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCategory.id,
          titel: categoryForm.titel,
          hauptkategorieId: categoryForm.hauptkategorieId || undefined,
          reihenfolge: categoryForm.reihenfolge ? parseInt(categoryForm.reihenfolge) : undefined
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowCategoryDialog(false)
        setEditingCategory(null)
        setCategoryForm({ titel: '', hauptkategorieId: '', reihenfolge: '' })
        onRefresh()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to update category:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Möchten Sie diese Kategorie wirklich löschen?')) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/categories?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        onRefresh()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert('Fehler beim Löschen')
    } finally {
      setIsLoading(false)
    }
  }

  const openEditMainCategory = (mainCategory: MainCategory) => {
    setEditingMainCategory(mainCategory)
    setMainCategoryForm({
      titel: mainCategory.titel,
      reihenfolge: mainCategory.reihenfolge.toString()
    })
    setShowMainCategoryDialog(true)
  }

  const openEditCategory = (category: CategoryWithMain) => {
    setEditingCategory(category)
    setCategoryForm({
      titel: category.titel,
      hauptkategorieId: category.hauptkategorie_id,
      reihenfolge: category.reihenfolge.toString()
    })
    setShowCategoryDialog(true)
  }

  const openNewMainCategory = () => {
    setEditingMainCategory(null)
    setMainCategoryForm({ titel: '', reihenfolge: '' })
    setShowMainCategoryDialog(true)
  }

  const openNewCategory = () => {
    setEditingCategory(null)
    setCategoryForm({ titel: '', hauptkategorieId: '', reihenfolge: '' })
    setShowCategoryDialog(true)
  }

  // Group categories by main category
  const categoriesByMain = mainCategories.map(main => ({
    ...main,
    categories: categories.filter(cat => cat.hauptkategorie_id === main.id)
  }))

  return (
    <div className="space-y-6">
      {/* Main Categories Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Hauptkategorien</CardTitle>
          <Button onClick={openNewMainCategory} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Neue Hauptkategorie
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {mainCategories.map((mainCat) => (
              <div key={mainCat.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{mainCat.titel}</p>
                    <p className="text-xs text-muted-foreground">Reihenfolge: {mainCat.reihenfolge}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditMainCategory(mainCat)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMainCategory(mainCat.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Categories Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Kategorien</CardTitle>
          <Button onClick={openNewCategory} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Neue Kategorie
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoriesByMain.map((mainCat) => (
              <div key={mainCat.id}>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">{mainCat.titel}</h3>
                <div className="space-y-2 ml-4">
                  {mainCat.categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Keine Kategorien</p>
                  ) : (
                    mainCat.categories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/30">
                        <div>
                          <p className="text-sm font-medium">{cat.titel}</p>
                          <p className="text-xs text-muted-foreground">Reihenfolge: {cat.reihenfolge}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditCategory(cat)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="h-7 w-7 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Category Dialog */}
      <Dialog open={showMainCategoryDialog} onOpenChange={setShowMainCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMainCategory ? 'Hauptkategorie bearbeiten' : 'Neue Hauptkategorie'}
            </DialogTitle>
            <DialogDescription>
              {editingMainCategory ? 'Ändern Sie die Hauptkategorie-Details' : 'Erstellen Sie eine neue Hauptkategorie'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="main-cat-titel">Titel *</Label>
              <Input
                id="main-cat-titel"
                value={mainCategoryForm.titel}
                onChange={(e) => setMainCategoryForm({ ...mainCategoryForm, titel: e.target.value })}
                placeholder="z.B. Campingausrüstung"
              />
            </div>
            <div>
              <Label htmlFor="main-cat-order">Reihenfolge</Label>
              <Input
                id="main-cat-order"
                type="number"
                value={mainCategoryForm.reihenfolge}
                onChange={(e) => setMainCategoryForm({ ...mainCategoryForm, reihenfolge: e.target.value })}
                placeholder="z.B. 1"
              />
            </div>
            <Button
              onClick={editingMainCategory ? handleUpdateMainCategory : handleCreateMainCategory}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Wird gespeichert...' : editingMainCategory ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
      </ResponsiveModal>

      {/* Category Dialog */}
      <ResponsiveModal
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        title={editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
        description={editingCategory ? 'Ändern Sie die Kategorie-Details' : 'Erstellen Sie eine neue Kategorie'}
      >
        <div className="space-y-4">
            <div>
              <Label htmlFor="cat-titel">Titel *</Label>
              <Input
                id="cat-titel"
                value={categoryForm.titel}
                onChange={(e) => setCategoryForm({ ...categoryForm, titel: e.target.value })}
                placeholder="z.B. Grundausstattung"
              />
            </div>
            <div>
              <Label htmlFor="cat-main">Hauptkategorie *</Label>
              <Select
                value={categoryForm.hauptkategorieId}
                onValueChange={(value) => setCategoryForm({ ...categoryForm, hauptkategorieId: value })}
              >
                <SelectTrigger id="cat-main">
                  <SelectValue placeholder="Wählen Sie eine Hauptkategorie" />
                </SelectTrigger>
                <SelectContent>
                  {mainCategories.map((main) => (
                    <SelectItem key={main.id} value={main.id}>
                      {main.titel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cat-order">Reihenfolge</Label>
              <Input
                id="cat-order"
                type="number"
                value={categoryForm.reihenfolge}
                onChange={(e) => setCategoryForm({ ...categoryForm, reihenfolge: e.target.value })}
                placeholder="z.B. 1"
              />
            </div>
            <Button
              onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Wird gespeichert...' : editingCategory ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
      </ResponsiveModal>
    </div>
  )
}
