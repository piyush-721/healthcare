from apps.accounts.models import User

from .models import PatientProfile, Relationship


def create_self_profile(user: User) -> PatientProfile:
    return PatientProfile.objects.create(
        owner=user,
        is_self=True,
        relationship_to_owner=Relationship.SELF,
        full_name=user.full_name,
    )


def get_self_profile(user: User) -> PatientProfile:
    profile = PatientProfile.objects.filter(owner=user, is_self=True).first()
    return profile or create_self_profile(user)
