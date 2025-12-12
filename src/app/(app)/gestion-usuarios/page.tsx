"use client";

import { useEffect, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Pencil, Trash2, Plus } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateUserPassword, deleteUser, createUser, getUsers, updateUserRole } from "./actions";

export default function GestionUsuariosPage() {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Edit Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [newPassword, setNewPassword] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Delete Dialog State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Create User State
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newUserUsername, setNewUserUsername] = useState("");
    const [newUserPassword, setNewUserPassword] = useState("");
    const [newUserRole, setNewUserRole] = useState("revendedor");
    const [isCreating, setIsCreating] = useState(false);

    // Fetch Users
    const fetchProfiles = async () => {
        setIsLoading(true);
        const result = await getUsers();
        if (result.error) {
            toast.error("Error al cargar usuarios");
            console.error(result.error);
        } else {
            setProfiles(result.users || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleEditClick = (user: any) => {
        setSelectedUser(user);
        setNewPassword("");
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (user: any) => {
        setUserToDelete(user);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);

        const result = await deleteUser(userToDelete.id);

        setIsDeleting(false);
        setIsDeleteDialogOpen(false);

        if (result.error) {
            toast.error("Error al eliminar usuario", { description: result.error });
        } else {
            toast.success(`Usuario ${userToDelete.nombre} eliminado`);
            fetchProfiles(); // Refresh list
        }
    };

    const handleCreateUser = async () => {
        if (!newUserUsername.trim() || !newUserPassword.trim()) {
            toast.error("Por favor complete todos los campos");
            return;
        }
        if (newUserPassword.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setIsCreating(true);
        const result = await createUser({
            username: newUserUsername,
            password: newUserPassword,
            rol: newUserRole,
        });
        setIsCreating(false);

        if (result.error) {
            toast.error("Error al crear usuario", { description: result.error });
        } else {
            toast.success("Usuario creado exitosamente");
            setIsCreateDialogOpen(false);
            setNewUserUsername("");
            setNewUserPassword("");
            setNewUserRole("revendedor");
            fetchProfiles();
        }
    };

    const handleSavePassword = async () => {
        if (!selectedUser) return;
        if (newPassword.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setIsSaving(true);
        const result = await updateUserPassword(selectedUser.id, newPassword);
        setIsSaving(false);

        if (result.error) {
            toast.error("Error al actualizar contraseña", {
                description: result.error,
            });
        } else {
            toast.success(`Contraseña actualizada para ${selectedUser.nombre}`);
            setIsDialogOpen(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        // Optimistic update
        setProfiles(prev => prev.map(p => p.id === userId ? { ...p, rol: newRole } : p));

        const result = await updateUserRole(userId, newRole);
        if (result.error) {
            toast.error("Error al actualizar rol");
            // Revert
            fetchProfiles();
        } else {
            toast.success("Rol actualizado");
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="animate-spin h-8 w-8" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-10">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                    <CardTitle className="text-2xl font-bold">Gestión de Usuarios</CardTitle>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Usuario
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Avatar</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead className="w-[100px] text-center">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {profiles.map((profile) => (
                                <TableRow key={profile.id}>
                                    <TableCell>
                                        <Avatar>
                                            <AvatarFallback>
                                                {profile.nombre ? profile.nombre.charAt(0).toUpperCase() : "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{profile.nombre}</span>
                                            <span className="text-xs text-muted-foreground">{profile.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            value={profile.rol}
                                            onValueChange={(val) => handleRoleChange(profile.id, val)}
                                        >
                                            <SelectTrigger className="w-[130px] h-8">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Administrador</SelectItem>
                                                <SelectItem value="revendedor">Revendedor</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-100/50"
                                                onClick={() => handleEditClick(profile)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-100/50"
                                                onClick={() => handleDeleteClick(profile)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Password Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cambiar contraseña</DialogTitle>
                        <DialogDescription>
                            Ingrese la nueva contraseña para <b>{selectedUser?.nombre}</b>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="password">Nueva contraseña</Label>
                            <Input
                                id="password"
                                type="text"
                                placeholder="Escribe la nueva contraseña..."
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Recomendamos usar una contraseña segura.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSavePassword} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                "Guardar cambios"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Alert */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente al usuario <b>{userToDelete?.nombre}</b> y no podrá iniciar sesión nuevamente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Eliminando...
                                </>
                            ) : (
                                "Eliminar"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create User Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                        <DialogDescription>
                            Complete los datos para registrar un nuevo usuario en el sistema.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="newUsername">Usuario</Label>
                            <Input
                                id="newUsername"
                                placeholder="Nombre de usuario"
                                value={newUserUsername}
                                onChange={(e) => setNewUserUsername(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="newRole">Rol</Label>
                            <Select value={newUserRole} onValueChange={setNewUserRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                    <SelectItem value="revendedor">Revendedor</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="newPassword">Contraseña</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                placeholder="Contraseña segura"
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleCreateUser} disabled={isCreating}>
                            {isCreating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                "Crear Usuario"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
